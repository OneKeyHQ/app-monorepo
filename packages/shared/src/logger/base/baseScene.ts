import { LogToConsole } from './decorators';

export abstract class BaseScene {
  constructor() {
    this.timestamp = Date.now();
  }

  timestamp: number;

  lastTimestamp?: number;

  resetTimestamp() {
    this.timestamp = Date.now();
    this.lastTimestamp = this.timestamp;
  }

  @LogToConsole()
  ignoreDurationBegin() {
    // return empty array to avoid log
    return [];
  }

  @LogToConsole()
  ignoreDurationEnd() {
    const now = Date.now();
    const duration = now - (this.lastTimestamp ?? now);
    this.lastTimestamp = now;
    this.timestamp += duration;
    // return empty array to avoid log
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

  mockBaseSceneMethod() {
    return '';
  }
}
