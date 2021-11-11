import fetch from 'node-fetch';

import BaseProcess, { Status } from './BaseProcess';

class BridgeProcess extends BaseProcess {
  constructor() {
    super('bridge', 'onekeyd', {
      startupCooldown: 3,
    });
  }

  async status(): Promise<Status> {
    // service
    try {
      const resp = await fetch('http://127.0.0.1:21320/', {
        method: 'POST',
        headers: {
          Origin: 'http://localhost:8000',
        },
      });
      this.logger.debug(this.logTopic, `Checking status (${resp.status})`);
      if (resp.status === 200) {
        const data = (await resp.json()) as { version?: number };
        if (data?.version) {
          return {
            service: true,
            process: true,
          };
        }
      }
    } catch (err) {
      if (err instanceof Error) {
        this.logger.error(this.logTopic, `Status error: ${err.message}`);
      }
    }

    // process
    return {
      service: false,
      process: Boolean(this.process),
    };
  }

  async startDev(): Promise<void> {
    await this.start(['-e', '21324']);
  }
}

export default BridgeProcess;
