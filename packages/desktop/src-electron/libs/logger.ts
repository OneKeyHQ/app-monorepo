/* eslint-disable no-undef */
import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import { app } from 'electron';

const logLevels = ['mute', 'error', 'warn', 'info', 'debug'] as const;
export type LogLevel = typeof logLevels[number];

export type Options = {
  colors?: boolean; // Console output has colors
  writeToConsole?: boolean; // Output is displayed in the console
  writeToDisk?: boolean; // Output is written to a file
  outputFile?: string; // file name for the output
  outputPath?: string; // path for the output
  logFormat?: string; // Output format of the log
};

export const defaultOptions: Options = {
  colors: true,
  writeToConsole: true,
  writeToDisk: false,
  outputFile: 'onekey-desktop-log-%ts.txt',
  outputPath: app?.getPath('home') ?? process.cwd(),
  logFormat: '%dt - %lvl(%top): %msg',
} as const;

class Logger implements ILogger {
  static instance: Logger;

  private stream: fs.WriteStream | undefined;

  private options: Options;

  private logLevel = 0;

  constructor(level: LogLevel, options?: Options) {
    this.logLevel = logLevels.indexOf(level);
    this.options = {
      ...defaultOptions,
      ...options,
    };

    if (this.logLevel > 0 && this.options.writeToDisk) {
      if (!this.options.outputFile) {
        this.error(
          'logger',
          `Can't write log to file because outputFile is not properly set (${
            this.options.outputFile ?? ''
          })`,
        );
        return;
      }

      if (!this.options.outputPath) {
        this.error(
          'logger',
          `Can't write log to file because outputPath is not properly set (${
            this.options.outputPath ?? ''
          })`,
        );
        return;
      }

      this.stream = fs.createWriteStream(
        path.join(
          this.options.outputPath,
          this.format(this.options.outputFile),
        ),
      );
    }
  }

  private log(level: LogLevel, topic: string, message: string | string[]) {
    const { writeToConsole, writeToDisk, logFormat } = this.options;

    if ((!writeToConsole && !writeToDisk) || !logFormat) {
      return;
    }

    const logLevel = logLevels.indexOf(level);
    if (this.logLevel < logLevel) {
      return;
    }

    const messages: string[] =
      typeof message === 'string' ? [message] : message;
    messages.forEach((m) =>
      this.write(
        level,
        this.format(logFormat, {
          lvl: level.toUpperCase(),
          top: topic,
          msg: m,
        }),
      ),
    );
  }

  private write(level: LogLevel, message: string) {
    if (this.options.writeToConsole) {
      // eslint-disable-next-line no-console
      console.log(this.options.colors ? this.color(level, message) : message);
    }

    if (this.stream !== undefined) {
      this.stream.write(`${message}\n`);
    }
  }

  private format(format: string, strings: { [key: string]: string } = {}) {
    let message = format;

    Object.keys(strings).forEach((k) => {
      message = message.replace(`%${k}`, strings[k]);
    });

    message = message
      .replace('%dt', new Date().toISOString())
      .replace('%ts', (+new Date()).toString());

    return message;
  }

  private color(level: LogLevel, message: string) {
    switch (level) {
      case 'error':
        return chalk.red(message.replace('ERROR', chalk.bold('ERROR')));
      case 'warn':
        return message.replace('WARN', chalk.bold.yellow('WARN'));
      case 'info':
        return message.replace('INFO', chalk.bold.blue('INFO'));
      case 'debug':
        return message.replace('DEBUG', chalk.bold.cyan('DEBUG'));
      default:
        return message;
    }
  }

  public exit() {
    if (this.stream !== undefined) {
      this.stream.end();
    }
  }

  public error(topic: string, message: string | string[]) {
    this.log('error', topic, message);
  }

  public warn(topic: string, message: string | string[]) {
    this.log('warn', topic, message);
  }

  public info(topic: string, message: string | string[]) {
    this.log('info', topic, message);
  }

  public debug(topic: string, message: string | string[]) {
    this.log('debug', topic, message);
  }

  public get level() {
    return logLevels[this.logLevel];
  }
}

export default Logger;
