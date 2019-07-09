/*
 * Copyright (C) 2018 Garden Technologies, Inc. <info@garden.io>
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import { GetTaskResultParams } from "../../types/plugin/task/getTaskResult"
import { ContainerModule } from "../container/config"
import { HelmModule } from "./helm/config"
import { ModuleVersion } from "../../vcs/vcs"
import { KubernetesPluginContext, KubernetesProvider } from "./config"
import { KubeApi } from "./api"
import { getMetadataNamespace } from "./namespace"
import { RunTaskResult } from "../../types/plugin/task/runTask"
import { deserializeValues } from "../../util/util"
import { PluginContext } from "../../plugin-context"
import { LogEntry } from "../../logger/log-entry"
import { gardenAnnotationKey } from "../../util/string"
import { Module } from "../../types/module"
import * as hasha from "hasha"
import { upsertConfigMap } from "./util"
import { trimRunOutput } from "./helm/common"

export async function getTaskResult(
  { ctx, log, module, task, taskVersion }: GetTaskResultParams<ContainerModule | HelmModule>,
): Promise<RunTaskResult | null> {
  const k8sCtx = <KubernetesPluginContext>ctx
  const api = await KubeApi.factory(log, k8sCtx.provider.config.context)
  const ns = await getMetadataNamespace(k8sCtx, log, k8sCtx.provider)
  const resultKey = getTaskResultKey(ctx, module, task.name, taskVersion)

  try {
    const res = await api.core.readNamespacedConfigMap(resultKey, ns)
    const result: any = deserializeValues(res.data!)

    // Backwards compatibility for modified result schema
    if (result.version.versionString) {
      result.version = result.version.versionString
    }

    return <RunTaskResult>result
  } catch (err) {
    if (err.code === 404) {
      return null
    } else {
      throw err
    }
  }
}

export function getTaskResultKey(ctx: PluginContext, module: Module, taskName: string, version: ModuleVersion) {
  const key = `${ctx.projectName}--${module.name}--${taskName}--${version.versionString}`
  const hash = hasha(key, { algorithm: "sha1" })
  return `task-result--${hash.slice(0, 32)}`
}

interface StoreTaskResultParams {
  ctx: PluginContext,
  log: LogEntry,
  module: Module,
  taskName: string,
  taskVersion: ModuleVersion,
  result: RunTaskResult,
}

/**
 * Store a task run result as a ConfigMap in the cluster.
 *
 * TODO: Implement a CRD for this.
 */
export async function storeTaskResult(
  { ctx, log, module, taskName, taskVersion, result }: StoreTaskResultParams,
) {
  const provider = <KubernetesProvider>ctx.provider
  const api = await KubeApi.factory(log, provider.config.context)
  const namespace = await getMetadataNamespace(ctx, log, provider)

  await upsertConfigMap({
    api,
    namespace,
    key: getTaskResultKey(ctx, module, taskName, taskVersion),
    labels: {
      [gardenAnnotationKey("module")]: module.name,
      [gardenAnnotationKey("task")]: taskName,
      [gardenAnnotationKey("moduleVersion")]: module.version.versionString,
      [gardenAnnotationKey("version")]: taskVersion.versionString,
    },
    data: trimRunOutput(result),
  })
}
