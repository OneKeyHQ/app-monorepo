/* eslint-disable no-undef */
import path from 'path';
import { spawn, ChildProcess } from 'child_process';
import isDev from 'electron-is-dev';

export type Status = {
  service: boolean;
  process: boolean;
};

/**
 * [startupCooldown] Cooldown before being able to run start again (seconds).
 * [stopKillWait] How long to wait before killing the process on stop (seconds).
 * [autoRestart] Seconds to wait before auto-restarting the process (seconds). 0 = off.
 */
export type Options = {
  startupCooldown?: number;
  stopKillWait?: number;
  autoRestart?: number;
};

const defaultOptions: Options = {
  startupCooldown: 0,
  stopKillWait: 10,
  autoRestart: 2,
} as const;

abstract class BaseProcess {
  process: ChildProcess | null;

  resourceName: string;

  processName: string;

  options: Options;

  startupThrottle: ReturnType<typeof setTimeout> | null;

  supportedSystems = ['linux-arm64', 'linux-x64', 'mac-x64', 'win-x64'];

  stopped = false;

  logger: ILogger;

  logTopic: string;

  /**
   * @param resourceName Resource folder name
   * @param processName Process name (without extension)
   * @param options Additional options
   */
  constructor(resourceName = '', processName = '', options = defaultOptions) {
    this.process = null;
    this.startupThrottle = null;
    this.resourceName = resourceName;
    this.processName = processName;
    this.options = {
      ...defaultOptions,
      ...options,
    };

    const { logger } = global;
    this.logger = logger;
    this.logTopic = `process-${this.processName}`;

    const { system } = this.getPlatformInfo();
    if (!this.isSystemSupported(system)) {
      this.logger.error(this.logTopic, `Unsupported system (${system})`);
    }
  }

  /**
   * Returns the status of the service/process
   * - service: The service is working
   * - process: The process is running
   */
  abstract status(): Promise<{ service: boolean; process: boolean }>;

  /**
   * Start the bundled process
   * @param params Command line parameters for the process
   */
  async start(params: string[] = []) {
    if (this.startupThrottle) {
      this.logger.warn(this.logTopic, 'Canceling process start (throttle)');
      return;
    }

    const status = await this.status();

    // Service is running, nothing to do
    if (status.service) {
      this.logger.warn(
        this.logTopic,
        'Canceling process start (service running)',
      );
      return;
    }

    // If the process is running but the service isn't
    if (status.process) {
      this.logger.warn(this.logTopic, 'Process is running but service is not');
      // Stop the process
      await this.stop();
    }

    // Throttle process start
    if (this.options.startupCooldown && this.options.startupCooldown > 0) {
      this.logger.debug(
        this.logTopic,
        `Setting a restart throttle (${this.options.startupCooldown})`,
      );
      this.startupThrottle = setTimeout(() => {
        this.logger.debug(this.logTopic, 'Clearing throttle');
        this.startupThrottle = null;
      }, this.options.startupCooldown * 1000);
    }

    this.stopped = false;

    const { system, ext } = this.getPlatformInfo();
    const processDir = path.join(
      global.resourcesPath,
      'bin',
      this.resourceName,
      isDev ? system : '',
    );
    const processPath = path.join(processDir, `${this.processName}${ext}`);
    const processEnv = { ...process.env };
    // library search path for macOS
    processEnv.DYLD_LIBRARY_PATH = processEnv.DYLD_LIBRARY_PATH
      ? `${processEnv.DYLD_LIBRARY_PATH}:${processDir}`
      : `${processDir}`;
    // library search path for Linux
    processEnv.LD_LIBRARY_PATH = processEnv.LD_LIBRARY_PATH
      ? `${processEnv.LD_LIBRARY_PATH}:${processDir}`
      : `${processDir}`;

    this.logger.info(this.logTopic, [
      'Starting process:',
      `- Path: ${processPath}`,
      `- Params: ${params.join(',')}`,
      `- CWD: ${processDir}`,
    ]);
    this.process = spawn(processPath, params, {
      cwd: processDir,
      env: processEnv,
    });
    this.process.on('error', (err) => this.onError(err));
    this.process.on('exit', (code) => this.onExit(code));
  }

  /**
   * Stops the process
   */
  stop() {
    return new Promise<void>((resolve) => {
      this.stopped = true;

      if (!this.process) {
        this.logger.warn(
          this.logTopic,
          "Couldn't stop process (already stopped)",
        );
        resolve();
        return;
      }

      this.logger.info(this.logTopic, 'Stopping process');
      this.process.kill();

      let timeout = 0;
      const interval = setInterval(() => {
        if (!this.process || this.process.killed) {
          this.logger.info(this.logTopic, 'Killed successfully');
          clearInterval(interval);
          this.process = null;
          resolve();
          return;
        }

        if (this.options.stopKillWait && timeout < this.options.stopKillWait) {
          this.logger.info(this.logTopic, 'Still alive, checking again...');
          // eslint-disable-next-line no-plusplus
          timeout++;
        } else {
          this.logger.info(this.logTopic, 'Still alive, going for the SIGKILL');
          this.process.kill('SIGKILL');
        }
      }, 1000);
    });
  }

  /**
   * Restart the process
   * @param force Force the restart
   */
  async restart() {
    this.logger.info(this.logTopic, 'Restarting');
    await this.stop();
    await this.start();
  }

  onError(err: Error) {
    this.logger.error(this.logTopic, err.message);
  }

  onExit(code: number | null) {
    this.logger.info(
      this.logTopic,
      `Exited, code: ${code ?? 'N/A'} (Stopped: ${
        this.stopped ? 'yes' : 'no'
      })`,
    );
    this.process = null;

    if (
      this.options.autoRestart &&
      this.options.autoRestart > 0 &&
      !this.stopped
    ) {
      this.logger.debug(this.logTopic, 'Auto restarting...');
      let restartDelay = this.options.autoRestart;

      // Add throttle delay to prevent the process from never restarting if the throttle is hit
      if (this.startupThrottle && this.options.startupCooldown) {
        restartDelay += this.options.startupCooldown;
      }

      setTimeout(() => this.start(), restartDelay * 1000);
    }
  }

  ///
  isSystemSupported(system: string) {
    return this.supportedSystems.includes(system);
  }

  getPlatformInfo() {
    const { arch } = process;
    const platform = this.getPlatform();
    const ext = platform === 'win' ? '.exe' : '';
    const system = `${platform}-${arch}`;
    return {
      system,
      platform,
      arch,
      ext,
    };
  }

  getPlatform() {
    switch (process.platform) {
      case 'darwin':
        return 'mac';
      case 'win32':
        return 'win';
      default:
        return process.platform;
    }
  }
}

export default BaseProcess;
