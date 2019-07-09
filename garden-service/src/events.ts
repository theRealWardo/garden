/*
 * Copyright (C) 2018 Garden Technologies, Inc. <info@garden.io>
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import { EventEmitter2 } from "eventemitter2"
import { TaskResult } from "./task-graph"
import { ModuleVersion } from "./vcs/vcs"
import { LogEntry } from "./logger/log-entry"

/**
 * This simple class serves as the central event bus for a Garden instance. Its function
 * is mainly to consolidate all events for the instance, to ensure type-safety.
 *
 * See below for the event interfaces.
 */
export class EventBus extends EventEmitter2 {
  constructor(private log: LogEntry) {
    super({
      wildcard: false,
      newListener: false,
      maxListeners: 100,    // we may need to adjust this
    })
  }

  emit<T extends EventName>(name: T, payload: Events[T]) {
    this.log.silly(`Emit event '${name}'`)
    return super.emit(name, payload)
  }

  on<T extends EventName>(name: T, listener: (payload: Events[T]) => void) {
    return super.on(name, listener)
  }

  onAny(listener: <T extends EventName>(name: T, payload: Events[T]) => void) {
    return super.onAny(<any>listener)
  }

  once<T extends EventName>(name: T, listener: (payload: Events[T]) => void) {
    return super.once(name, listener)
  }

  // TODO: wrap more methods to make them type-safe
}

/**
 * The supported events and their interfaces.
 */
export interface Events {
  // Internal test/control events
  _restart: string,
  _test: string,

  // Watcher events
  configAdded: {
    path: string,
  },
  configRemoved: {
    path: string,
  },
  projectConfigChanged: {},
  moduleConfigChanged: {
    names: string[],
    path: string,
  },
  moduleSourcesChanged: {
    names: string[],
    pathChanged: string,
  },
  moduleRemoved: {
  },

  // TaskGraph events
  taskPending: {
    addedAt: Date,
    key: string,
    version: ModuleVersion,
  },
  taskProcessing: {
    startedAt: Date,
    key: string,
    version: ModuleVersion,
  },
  taskCancelled: {
    cancelledAt: Date,
    type: string
    key: string,
    name: string,
  },
  taskComplete: TaskResult,
  taskError: TaskResult,
  taskGraphProcessing: {
    startedAt: Date,
  },
  taskGraphComplete: {
    completedAt: Date,
  },
}

export type EventName = keyof Events
