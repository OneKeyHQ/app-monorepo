import { app } from 'electron';

import {
  DESKTOP_DEEP_LINK_PROTOCOLS,
  getDesktopProtocolClientArgs,
} from './deepLink';

type IRegisterDesktopProtocolClientsParams = {
  defaultApp: boolean | undefined;
  argv: string[];
  execPath: string;
};

/**
 * Register the OneKeyURL schemes as default protocol clients.
 *
 * Always include `'--'` before `"%1"` on Windows so Chromium option parsing
 * terminates before the external URL argument (prevents switch injection).
 * Passing `execPath` and the computed protocol client args to
 * `isDefaultProtocolClient` also upgrades legacy bare `"%1"` registry entries.
 */
export function registerDesktopProtocolClients({
  defaultApp,
  argv,
  execPath,
}: IRegisterDesktopProtocolClientsParams): void {
  if (defaultApp && argv.length < 2) {
    return;
  }

  const protocolClientArgs = getDesktopProtocolClientArgs(defaultApp, argv);
  for (const protocol of DESKTOP_DEEP_LINK_PROTOCOLS) {
    if (!app.isDefaultProtocolClient(protocol, execPath, protocolClientArgs)) {
      app.setAsDefaultProtocolClient(protocol, execPath, protocolClientArgs);
    }
  }
}
