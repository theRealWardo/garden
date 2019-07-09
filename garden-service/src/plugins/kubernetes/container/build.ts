/*
 * Copyright (C) 2018 Garden Technologies, Inc. <info@garden.io>
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import pRetry from "p-retry"
import { ContainerModule } from "../../container/config"
import { containerHelpers } from "../../container/helpers"
import { buildContainerModule, getContainerBuildStatus, getDockerBuildFlags } from "../../container/build"
import { GetBuildStatusParams, BuildStatus } from "../../../types/plugin/module/getBuildStatus"
import { BuildModuleParams, BuildResult } from "../../../types/plugin/module/build"
import { getPortForward, getPods, millicpuToString, megabytesToString } from "../util"
import { systemNamespace } from "../system"
import { RSYNC_PORT } from "../constants"
import execa = require("execa")
import { posix, resolve } from "path"
import { KubeApi } from "../api"
import { kubectl } from "../kubectl"
import { LogEntry } from "../../../logger/log-entry"
import { KubernetesProvider, ContainerBuildMode, KubernetesPluginContext } from "../config"
import { PluginError } from "../../../exceptions"
import { runPod } from "../run"
import { getRegistryHostname } from "../init"
import { getManifestFromRegistry } from "./util"

const dockerDaemonDeploymentName = "garden-docker-daemon"
const dockerDaemonContainerName = "docker-daemon"
// TODO: make build timeout configurable
const buildTimeout = 600
// Note: v0.9.0 appears to be completely broken: https://github.com/GoogleContainerTools/kaniko/issues/268
const kanikoImage = "gcr.io/kaniko-project/executor:v0.8.0"
const registryPort = 5000
const syncDataVolumeName = "garden-build-sync"
const syncDeploymentName = "garden-build-sync"

export async function k8sGetContainerBuildStatus(
  params: GetBuildStatusParams<ContainerModule>,
): Promise<BuildStatus> {
  const { ctx, module } = params
  const provider = <KubernetesProvider>ctx.provider

  const hasDockerfile = await containerHelpers.hasDockerfile(module)

  if (!hasDockerfile) {
    // Nothing to build
    return { ready: true }
  }

  const handler = buildStatusHandlers[provider.config.buildMode]
  return handler(params)
}

export async function k8sBuildContainer(params: BuildModuleParams<ContainerModule>): Promise<BuildResult> {
  const { ctx } = params
  const provider = <KubernetesProvider>ctx.provider
  const handler = buildHandlers[provider.config.buildMode]
  return handler(params)
}

type BuildStatusHandler = (params: GetBuildStatusParams<ContainerModule>) => Promise<BuildStatus>

const getLocalBuildStatus: BuildStatusHandler = async (params) => {
  const { ctx } = params
  const status = await getContainerBuildStatus(params)

  if (ctx.provider.config.deploymentRegistry) {
    // TODO: Check if the image exists in the remote registry
    // Note: Waiting for the `docker registry ls` command to be available in Docker 19.03. Otherwise we'll need to
    // attempt to handle all kinds of authentication cases.
  }

  return status
}

const getRemoteBuildStatus: BuildStatusHandler = async (params) => {
  const { ctx, module, log } = params
  const k8sCtx = ctx as KubernetesPluginContext
  const manifest = await getManifestFromRegistry(k8sCtx, module, log)

  return { ready: !!manifest }
}

const buildStatusHandlers: { [mode in ContainerBuildMode]: BuildStatusHandler } = {
  "local-docker": getLocalBuildStatus,
  "cluster-docker": getRemoteBuildStatus,
  "kaniko": getRemoteBuildStatus,
}

type BuildHandler = (params: BuildModuleParams<ContainerModule>) => Promise<BuildResult>

const localBuild: BuildHandler = async (params) => {
  const { ctx, module, log } = params
  const buildResult = await buildContainerModule(params)

  if (!ctx.provider.config.deploymentRegistry) {
    return buildResult
  }

  if (!(await containerHelpers.hasDockerfile(module))) {
    return buildResult
  }

  const localId = await containerHelpers.getLocalImageId(module)
  const remoteId = await containerHelpers.getDeploymentImageId(module, ctx.provider.config.deploymentRegistry)

  log.setState({ msg: `Pushing image ${remoteId} to cluster...` })

  await containerHelpers.dockerCli(module, ["tag", localId, remoteId])
  await containerHelpers.dockerCli(module, ["push", remoteId])

  return buildResult
}

const remoteBuild: BuildHandler = async (params) => {
  const { ctx, module, log } = params
  const provider = <KubernetesProvider>ctx.provider

  if (!(await containerHelpers.hasDockerfile(module))) {
    return {}
  }

  // Sync the build context to the remote sync service
  // -> Get a tunnel to the service
  log.setState("Syncing sources to cluster...")
  const syncFwd = await getPortForward({
    ctx,
    log,
    namespace: systemNamespace,
    targetDeployment: `Deployment/${syncDeploymentName}`,
    port: RSYNC_PORT,
  })

  // -> Run rsync
  const buildRoot = resolve(module.buildPath, "..")
  // This trick is used to automatically create the correct target directory with rsync:
  // https://stackoverflow.com/questions/1636889/rsync-how-can-i-configure-it-to-create-target-directory-on-server
  const src = `${buildRoot}/./${module.name}/`
  const destination = `rsync://localhost:${syncFwd.localPort}/volume/${ctx.workingCopyId}/`

  log.debug(`Syncing from ${src} to ${destination}`)

  // We retry a couple of times, because we may get intermittent connection issues or concurrency issues
  await pRetry(
    () => execa("rsync", ["-vrpztgo", "--relative", "--delete", src, destination]),
    { retries: 3, minTimeout: 500 },
  )

  const localId = await containerHelpers.getLocalImageId(module)
  const deploymentImageId = await containerHelpers.getDeploymentImageId(module, provider.config.deploymentRegistry)
  const dockerfile = module.spec.dockerfile || "Dockerfile"

  // Because we're syncing to a shared volume, we need to scope by a unique ID
  const contextPath = `/garden-build/${ctx.workingCopyId}/${module.name}/`

  log.setState(`Building image ${localId}...`)

  let buildLog = ""

  if (provider.config.buildMode === "cluster-docker") {
    // Prepare the build command
    const dockerfilePath = posix.join(contextPath, dockerfile)

    const args = [
      "docker", "build",
      "-t", deploymentImageId,
      "-f", dockerfilePath,
      contextPath,
      ...getDockerBuildFlags(module),
    ]

    // Execute the build
    const podName = await getBuilderPodName(provider, log)
    const buildRes = await execInBuilder({ provider, log, args, timeout: buildTimeout, podName })
    buildLog = buildRes.stdout + buildRes.stderr

    // Push the image to the registry
    log.setState({ msg: `Pushing image ${localId} to registry...` })

    const dockerCmd = ["docker", "push", deploymentImageId]
    const pushArgs = ["/bin/sh", "-c", dockerCmd.join(" ")]

    const pushRes = await execInBuilder({ provider, log, args: pushArgs, timeout: 300, podName })
    buildLog += pushRes.stdout + pushRes.stderr

  } else {
    // build with Kaniko
    const args = [
      "executor",
      "--context", "dir://" + contextPath,
      "--dockerfile", dockerfile,
      "--destination", deploymentImageId,
      "--cache=true",
      "--insecure",   // The in-cluster registry is not exposed, so we don't configure TLS on it.
      // "--verbosity", "debug",
      ...getDockerBuildFlags(module),
    ]

    // Execute the build
    const buildRes = await runKaniko(provider, log, module, args)
    buildLog = buildRes.output
  }

  log.silly(buildLog)

  return {
    buildLog,
    fetched: false,
    fresh: true,
    version: module.version.versionString,
  }
}

interface BuilderExecParams {
  provider: KubernetesProvider,
  log: LogEntry,
  args: string[],
  timeout: number,
  podName: string,
}

const buildHandlers: { [mode in ContainerBuildMode]: BuildHandler } = {
  "local-docker": localBuild,
  "cluster-docker": remoteBuild,
  "kaniko": remoteBuild,
}

// TODO: we should make a simple service around this instead of execing into containers
export async function execInBuilder({ provider, log, args, timeout, podName }: BuilderExecParams) {
  const execCmd = ["exec", "-i", podName, "-c", dockerDaemonContainerName, "--", ...args]

  log.verbose(`Running: kubectl ${execCmd.join(" ")}`)

  return kubectl.exec({
    args: execCmd,
    context: provider.config.context,
    log,
    namespace: systemNamespace,
    timeout,
  })
}

export async function getBuilderPodName(provider: KubernetesProvider, log: LogEntry) {
  const api = await KubeApi.factory(log, provider.config.context)

  const builderStatusRes = await api.apps.readNamespacedDeployment(dockerDaemonDeploymentName, systemNamespace)
  const builderPods = await getPods(api, systemNamespace, builderStatusRes.spec.selector.matchLabels)
  const pod = builderPods[0]

  if (!pod) {
    throw new PluginError(`Could not find running image builder`, {
      builderDeploymentName: dockerDaemonDeploymentName,
      systemNamespace,
    })
  }

  return builderPods[0].metadata.name
}

async function runKaniko(provider: KubernetesProvider, log: LogEntry, module: ContainerModule, args: string[]) {
  const podName = `kaniko-${module.name}-${Math.round(new Date().getTime())}`
  const registryHostname = getRegistryHostname()

  return runPod({
    context: provider.config.context,
    ignoreError: false,
    image: kanikoImage,
    interactive: false,
    log,
    module,
    namespace: systemNamespace,
    spec: {
      shareProcessNamespace: true,
      containers: [
        {
          name: "kaniko",
          image: kanikoImage,
          args,
          volumeMounts: [{
            name: syncDataVolumeName,
            mountPath: "/garden-build",
          }],
          resources: {
            limits: {
              cpu: millicpuToString(provider.config.resources.builder.limits.cpu),
              memory: megabytesToString(provider.config.resources.builder.limits.memory),
            },
            requests: {
              cpu: millicpuToString(provider.config.resources.builder.requests.cpu),
              memory: megabytesToString(provider.config.resources.builder.requests.memory),
            },
          },
        },
        {
          name: "proxy",
          image: "basi/socat:v0.1.0",
          command: ["/bin/sh", "-c", `socat TCP-LISTEN:5000,fork TCP:${registryHostname}:5000 || exit 0`],
          ports: [{
            name: "proxy",
            containerPort: registryPort,
            protocol: "TCP",
          }],
          readinessProbe: {
            tcpSocket: { port: registryPort },
          },
        },
        // This is a little workaround so that the socat proxy doesn't just keep running after the build finishes.
        {
          name: "killer",
          image: "busybox",
          command: [
            "sh", "-c",
            "while true; do if pidof executor > /dev/null; then sleep 0.5; else killall socat; exit 0; fi done",
          ],
        },
      ],
      volumes: [{
        name: syncDataVolumeName,
        persistentVolumeClaim: { claimName: syncDataVolumeName },
      }],
    },
    podName,
    timeout: buildTimeout,
  })
}
