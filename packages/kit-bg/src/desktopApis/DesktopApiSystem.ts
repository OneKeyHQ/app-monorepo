import * as Sentry from '@sentry/electron/main';
import si from 'systeminformation';

import type { IDesktopSystemInfo } from '@onekeyhq/desktop/app/config';

class DesktopApiSystem {
  async getSystemInfo(): Promise<IDesktopSystemInfo> {
    const system = await si.system();
    const cpu = await si.cpu();
    const os = await si.osInfo();
    const data = Sentry.getGlobalScope().getScopeData();

    const result: IDesktopSystemInfo = {
      sentryContexts: data.contexts,
      system,
      cpu,
      os,
    };

    return result;
  }
}

export default DesktopApiSystem;
