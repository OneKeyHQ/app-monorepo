import utils from './utils';

import type { ILogLevel } from './types';

// Lightweight replacement for react-native-logs.
// Preserves the same output format ("HH:MM:SS | LEVEL : msg")
// but removes the redundant async deferral (logFn already has setTimeout).

type ILogFn = (msg: string) => void;
type ILogger = Record<ILogLevel, ILogFn>;

function formatAndSend(level: string, msg: string) {
  const d = new Date();
  const pad2 = (n: number) => String(n).padStart(2, '0');
  const ts = `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
  utils.consoleFunc(`${ts} | ${level.toUpperCase()} : ${msg}`);
}

const baseLogger: ILogger = {
  debug: (msg) => formatAndSend('debug', msg),
  info: (msg) => formatAndSend('info', msg),
  warn: (msg) => formatAndSend('warn', msg),
  error: (msg) => formatAndSend('error', msg),
};

export function getLoggerExtension(_name: string): ILogger {
  return baseLogger;
}
