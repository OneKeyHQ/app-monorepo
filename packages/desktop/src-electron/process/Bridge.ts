/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import logger from 'electron-log';
import fetch from 'node-fetch';

import BaseProcess, { Status } from './BaseProcess';

class BridgeProcess extends BaseProcess {
  constructor() {
    super('bridge', 'onekeyd', {
      startupThrottleTime: 3,
    });
  }

  async getStatus(): Promise<Status> {
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

export default BridgeProcess;
