import os from 'os';
import path from 'path';

import type { IDesktopApi } from '../base/types';
import type DesktopApiAppBundleUpdate from '../DesktopApiBundleUpdate';

export const USERDATA = path.join(os.tmpdir(), 'ocds-e2e-userdata');

export function makeApi(): DesktopApiAppBundleUpdate {
  // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
  const Api = require('../DesktopApiBundleUpdate')
    .default as typeof DesktopApiAppBundleUpdate;
  return new Api({ desktopApi: {} as IDesktopApi });
}
