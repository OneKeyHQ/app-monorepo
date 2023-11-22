/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import logger from 'electron-log';
import fetch from 'node-fetch';

import BaseProcess from './BaseProcess';

import type { IStatus } from './BaseProcess';

class BridgeProcess extends BaseProcess {
  constructor() {
    super('bridge', 'onekeyd', {
      startupThrottleTime: 3,
    });
    logger.info('logger file name =====> :', logger.transports.file.file);
  }

  async getStatus(): Promise<IStatus> {
    try {
      const resp = await fetch(`http://127.0.0.1:21320/`, {
        method: 'POST',
        headers: {
          Origin: 'https://electron.onekey.so',
        },
      });
      logger.debug(`Checking status (${resp.status})`);
      if (resp.status === 200) {
        const data = await resp.json();
        if (data?.version) {
          return {
            service: true,
            process: true,
          };
        }
      }
    } catch (err: any) {
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
      logger.error(`Status error: ${err.message}`);
    }

    // process
    return {
      service: false,
      process: Boolean(this.process),
    };
  }
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit & { timeout: number },
) {
  const { timeout = 3000 } = options;

  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  // @ts-expect-error
  const response = await fetch(url, {
    ...options,
    signal: controller.signal as any,
  });
  clearTimeout(id);
  return response;
}

export const BridgeHeart = {
  timer: null as ReturnType<typeof setInterval> | null,
  start: (callback: () => void) => {
    const checkBridge = async () => {
      try {
        const localBridgeUrl = 'http://127.0.0.1:21320/';
        const resp = await fetchWithTimeout(localBridgeUrl, {
          method: 'POST',
          headers: {
            Origin: 'https://electron.onekey.so',
          },
          timeout: 3000,
        });

        if (resp.status !== 200) {
          logger.debug(
            `Bridge Heart Checking ${localBridgeUrl} (${resp.status})`,
          );
          // check bridge failed, restart it
          callback?.();
        }
      } catch (err: any) {
        logger.error(
          // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
          `Bridge heart check error, will restart bridge process: ${err.message}`,
        );
        callback?.();
      }
    };

    BridgeHeart.timer = setInterval(checkBridge, 10000);
  },
};

export default BridgeProcess;
