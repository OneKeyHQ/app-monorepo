import { formatTime } from '../../utils/dateUtils';

import { LogToConsole, LogToServer } from './decorators';
import { logFn } from './logFn';

import type { IMethodDecoratorMetadata } from '../types';

export abstract class BaseScene {
  constructor() {
    this.timestamp = Date.now();
  }

  timestamp: number;

  lastTimestamp?: number;

  // Set by BaseScope.createScene — identifies this scene in the log pipeline
  scopeName = '';

  sceneName = '';

  // Temporary collector stack used by decorator wrappers.
  // Each logical method invocation owns one stack entry so nested scene calls
  // do not leak metadata into each other.
  _currentCallMetadataStack?: Array<{
    methodName: string;
    metadataList: IMethodDecoratorMetadata[];
    isCollectingDecorators: boolean;
  }>;

  resetTimestamp() {
    this.timestamp = Date.now();
    this.lastTimestamp = this.timestamp;
  }

  /** Called by the outermost decorator to emit a log entry. Do not call directly. */
  _emitLog(
    methodName: string,
    args: unknown[],
    metadataList: IMethodDecoratorMetadata[],
  ) {
    const now = new Date();

    const lastDuration =
      (now.getTime() - (this.lastTimestamp ?? now.getTime())) / 1000;
    const totalDuration = (now.getTime() - this.timestamp) / 1000;
    let duration = '';
    if (lastDuration < 100) {
      duration += `+${lastDuration.toFixed(3)}s`;
    }
    if (totalDuration < 100) {
      duration += `(${totalDuration.toFixed(1)}s)`;
    }

    this.lastTimestamp = now.getTime();

    const durationInfo = { duration, totalDuration, lastDuration };
    const timestamp = () => {
      const ts = formatTime(now, { formatTemplate: 'HH:mm:ss.SSS' });
      return `${ts} ${durationInfo.duration}`;
    };

    logFn({
      scopeName: this.scopeName,
      sceneName: this.sceneName,
      methodName,
      args,
      rawArgs: args,
      metadataList,
      durationInfo,
      timestamp,
    });
  }

  @LogToConsole()
  ignoreDurationBegin() {
    this.lastTimestamp = Date.now();
    return [];
  }

  @LogToServer()
  registerRid(rid: string) {
    return {
      jpush_rid: rid,
    };
  }

  @LogToConsole()
  ignoreDurationEnd() {
    const now = Date.now();
    const duration = now - (this.lastTimestamp ?? now);
    this.lastTimestamp = now;
    this.timestamp += duration;
    return [];
  }

  @LogToConsole()
  consoleLog(...args: any[]) {
    return args as unknown;
  }

  @LogToConsole({ level: 'error' })
  consoleError(...args: any[]) {
    return args as unknown;
  }
}
