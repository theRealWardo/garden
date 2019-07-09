/*
 * Copyright (C) 2018 Garden Technologies, Inc. <info@garden.io>
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import * as Bluebird from "bluebird"
import deline = require("deline")
import dedent = require("dedent")
import chalk from "chalk"
import { readFile } from "fs-extra"
import { flatten } from "lodash"
import moment = require("moment")
import { join } from "path"

import { BaseTask } from "../tasks/base"
import { getDependantTasksForModule } from "../tasks/helpers"
import {
  Command,
  CommandResult,
  CommandParams,
  StringsParameter,
  handleTaskResults,
  PrepareParams,
  BooleanParameter,
} from "./base"
import { STATIC_DIR } from "../constants"
import { processModules } from "../process"
import { Module } from "../types/module"
import { getTestTasks } from "../tasks/test"
import { HotReloadTask } from "../tasks/hot-reload"
import { ConfigGraph } from "../config-graph"
import { getHotReloadServiceNames, validateHotReloadServiceNames } from "./helpers"
import { GardenServer, startServer } from "../server/server"

const ansiBannerPath = join(STATIC_DIR, "garden-banner-2.txt")

const devArgs = {}

const devOpts = {
  "hot-reload": new StringsParameter({
    help: deline`The name(s) of the service(s) to deploy with hot reloading enabled.
      Use comma as a separator to specify multiple services. Use * to deploy all
      services with hot reloading enabled (ignores services belonging to modules that
      don't support or haven't configured hot reloading).
    `,
    alias: "hot",
  }),
  "skip-tests": new BooleanParameter({
    help: "Disable running the tests",
  }),
  "test-names": new StringsParameter({
    help: "The name(s) of the module(s) to test (skip to test all modules). " +
      "Accepts glob patterns (e.g. integ* would run both 'integ' and 'integration')",
    alias: "tn",
  }),
}

type Args = typeof devArgs
type Opts = typeof devOpts

// TODO: allow limiting to certain modules and/or services
export class DevCommand extends Command<Args, Opts> {
  name = "dev"
  help = "Starts the garden development console."

  // Currently it doesn't make sense to do file watching except in the CLI
  cliOnly = true

  description = dedent`
    The Garden dev console is a combination of the \`build\`, \`deploy\` and \`test\` commands.
    It builds, deploys and tests all your modules and services, and re-builds, re-deploys and re-tests
    as you modify the code.

    Examples:

        garden dev
        garden dev --hot=foo-service,bar-service  # enable hot reloading for foo-service and bar-service
        garden dev --hot=*                        # enable hot reloading for all compatible services
        garden dev --skip-tests=foo-service       # skip running any tests
        garden dev --name integ                   # run all tests with the name 'integ' in the project
        garden test --name integ*                 # run all tests with the name starting with 'integ' in the project
  `

  options = devOpts

  private server: GardenServer

  async prepare({ log, footerLog }: PrepareParams<Args, Opts>) {
    // print ANSI banner image
    const data = await readFile(ansiBannerPath)
    log.info(data.toString())

    log.info(chalk.gray.italic(`\nGood ${getGreetingTime()}! Let's get your environment wired up...\n`))

    this.server = await startServer(footerLog)
  }

  async action({ garden, log, footerLog, opts }: CommandParams<Args, Opts>): Promise<CommandResult> {
    this.server.setGarden(garden)

    const actions = await garden.getActionHelper()
    const graph = await garden.getConfigGraph()
    const modules = await graph.getModules()

    if (modules.length === 0) {
      footerLog && footerLog.setState({ msg: "" })
      log.info({ msg: "No modules found in project." })
      log.info({ msg: "Aborting..." })
      return {}
    }

    const hotReloadServiceNames = await getHotReloadServiceNames(opts["hot-reload"], graph)
    if (hotReloadServiceNames.length > 0) {
      const errMsg = await validateHotReloadServiceNames(hotReloadServiceNames, graph)
      if (errMsg) {
        log.error({ msg: errMsg })
        return { result: {} }
      }
    }

    await actions.prepareEnvironment({ log })

    const tasksForModule = (watch: boolean) => {
      return async (updatedGraph: ConfigGraph, module: Module) => {
        const tasks: BaseTask[] = []

        if (watch) {
          const hotReloadServices = await updatedGraph.getServices(hotReloadServiceNames)
          const hotReloadTasks = hotReloadServices
            .filter(service => service.module.name === module.name || service.sourceModule.name === module.name)
            .map(service => new HotReloadTask({ garden, graph: updatedGraph, log, service, force: true }))

          tasks.push(...hotReloadTasks)
        }

        const testModules: Module[] = watch
          ? (await updatedGraph.withDependantModules([module]))
          : [module]

        if (!opts["skip-tests"]) {
          const filterNames = opts["test-names"]
          tasks.push(...flatten(
            await Bluebird.map(
              testModules, m => getTestTasks({ garden, log, module: m, graph: updatedGraph, filterNames })),
          ))
        }

        tasks.push(...await getDependantTasksForModule({
          garden,
          log,
          graph: updatedGraph,
          module,
          fromWatch: watch,
          hotReloadServiceNames,
          force: watch,
          forceBuild: false,
          includeDependants: watch,
        }))

        return tasks
      }
    }

    const results = await processModules({
      garden,
      graph,
      log,
      footerLog,
      modules,
      watch: true,
      handler: tasksForModule(false),
      changeHandler: tasksForModule(true),
    })

    return handleTaskResults(footerLog, "dev", results)
  }
}

function getGreetingTime() {
  const m = moment()

  const currentHour = parseFloat(m.format("HH"))

  if (currentHour >= 17) {
    return "evening"
  } else if (currentHour >= 12) {
    return "afternoon"
  } else {
    return "morning"
  }
}
