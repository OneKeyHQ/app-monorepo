import { execFile } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { promisify } from 'util';

import { app } from 'electron';
import logger from 'electron-log/main';

import {
  ONEKEY_DESKTOP_NATIVE_MESSAGING_EXTENSION_IDS_ENV,
  ONEKEY_DESKTOP_NATIVE_MESSAGING_HOST_ARG,
  ONEKEY_DESKTOP_NATIVE_MESSAGING_HOST_NAME,
  getDesktopNativeMessagingAllowedExtensionIds,
  parseDesktopNativeMessagingEnvExtensionIds,
} from '@onekeyhq/shared/src/consts/desktopNativeMessaging';

const execFileAsync = promisify(execFile);

function shellQuote(value: string): string {
  const escaped = value.replace(/'/g, "'\\''");
  return `'${escaped}'`;
}

function cmdQuote(value: string): string {
  return `"${value.replace(/%/g, '%%')}"`;
}

// OneKey's dev desktop reports app.isPackaged === true even when running
// unpackaged via `electron <script>`, so app.isPackaged is NOT a reliable dev
// signal here. process.defaultApp is true only for an unpackaged/dev run.
function isDesktopDevRuntime(): boolean {
  return process.defaultApp === true;
}

function getAllowedExtensionIds(): string[] {
  const isDevRuntime = isDesktopDevRuntime();
  const envExtensionIds = isDevRuntime
    ? process.env[ONEKEY_DESKTOP_NATIVE_MESSAGING_EXTENSION_IDS_ENV]
    : undefined;
  return getDesktopNativeMessagingAllowedExtensionIds({
    includeDevExtensionIds: isDevRuntime,
    envExtensionIds,
  });
}

function getHostLauncherPath() {
  const fileExtension = process.platform === 'win32' ? 'cmd' : 'sh';
  // User-level Native Messaging registration is not a same-user tamper
  // boundary. A same-user process can modify the manifest or launcher path, so
  // the owner-auth protocol must not be treated as protection against local
  // user-account compromise.
  return path.join(
    app.getPath('userData'),
    'native-messaging-hosts',
    `${ONEKEY_DESKTOP_NATIVE_MESSAGING_HOST_NAME}.${fileExtension}`,
  );
}

// In an unpackaged/dev run the app is launched as `electron [flags...] <entry>`,
// so the entry script is the first NON-flag argument after argv[0] (the electron
// exe). process.argv[1] is NOT reliable: dev launches put electron switches
// (e.g. --inspect=5858) before the entry script, and using argv[1] would bake a
// bogus "--inspect=5858" app path into the launcher.
function getDevAppEntryScript(): string | undefined {
  return process.argv.slice(1).find((arg) => !arg.startsWith('-'));
}

function getHostLauncherArgs() {
  const args = [app.getPath('exe')];

  if (process.defaultApp) {
    const entryScript = getDevAppEntryScript();
    if (entryScript) {
      args.push(path.resolve(entryScript));
    }
  }

  args.push(ONEKEY_DESKTOP_NATIVE_MESSAGING_HOST_ARG);

  return args;
}

// Chrome spawns the host with its OWN environment, not the desktop dev
// process's. So custom IDs from ONEKEY_NATIVE_MESSAGING_EXTENSION_IDS (used to
// allow unpacked dev extensions) must be baked into the launcher here; otherwise
// the host recomputes an allow-list without them and rejects the caller with
// NATIVE_HOST_FORBIDDEN even though the manifest allowed the connection.
//
// Bake only the validated [a-p]{32} IDs (canonical comma-joined) — never the raw
// env string — so a crafted env value cannot inject into the generated shell /
// batch launcher, and the launcher allow-list matches the manifest's.
function getHostLauncherEnv(): Record<string, string> {
  if (!isDesktopDevRuntime()) {
    return {};
  }
  const extensionIds = parseDesktopNativeMessagingEnvExtensionIds(
    process.env[ONEKEY_DESKTOP_NATIVE_MESSAGING_EXTENSION_IDS_ENV],
  );
  if (!extensionIds.length) {
    return {};
  }
  return {
    [ONEKEY_DESKTOP_NATIVE_MESSAGING_EXTENSION_IDS_ENV]: extensionIds.join(','),
  };
}

function getUnixHostScript() {
  const commandParts = getHostLauncherArgs().map((arg) => shellQuote(arg));
  const exportLines = Object.entries(getHostLauncherEnv()).map(
    ([key, value]) => `export ${key}=${shellQuote(value)}\n`,
  );

  return `#!/bin/sh
${exportLines.join('')}exec ${commandParts.join(' ')} "$@"
`;
}

function getWindowsHostScript() {
  const launcherArgs = getHostLauncherArgs();
  const commandParts = launcherArgs.map((arg) => cmdQuote(arg));
  const setLines = Object.entries(getHostLauncherEnv()).map(
    ([key, value]) => `set "${key}=${value}"\r\n`,
  );
  return `@echo off\r
${setLines.join('')}if not exist ${cmdQuote(launcherArgs[0])} exit /b 1\r
${commandParts.join(' ')} %*\r
`;
}

function getHostScript() {
  if (process.platform === 'win32') {
    return getWindowsHostScript();
  }
  return getUnixHostScript();
}

function getMacOSNativeMessagingManifestDirs() {
  const home = os.homedir();
  return [
    path.join(
      home,
      'Library/Application Support/Google/Chrome/NativeMessagingHosts',
    ),
    path.join(
      home,
      'Library/Application Support/Chromium/NativeMessagingHosts',
    ),
    path.join(
      home,
      'Library/Application Support/BraveSoftware/Brave-Browser/NativeMessagingHosts',
    ),
    path.join(
      home,
      'Library/Application Support/Microsoft Edge/NativeMessagingHosts',
    ),
  ];
}

function getLinuxNativeMessagingManifestDirs() {
  const configHome =
    process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
  return [
    path.join(configHome, 'google-chrome/NativeMessagingHosts'),
    path.join(configHome, 'google-chrome-for-testing/NativeMessagingHosts'),
    path.join(configHome, 'chromium/NativeMessagingHosts'),
    path.join(configHome, 'BraveSoftware/Brave-Browser/NativeMessagingHosts'),
    path.join(configHome, 'microsoft-edge/NativeMessagingHosts'),
  ];
}

function getNativeMessagingManifestDirs() {
  if (process.platform === 'darwin') {
    return getMacOSNativeMessagingManifestDirs();
  }
  if (process.platform === 'linux') {
    return getLinuxNativeMessagingManifestDirs();
  }
  return [];
}

function getWindowsNativeMessagingRegistryKeys() {
  return [
    `HKEY_CURRENT_USER\\Software\\Google\\Chrome\\NativeMessagingHosts\\${ONEKEY_DESKTOP_NATIVE_MESSAGING_HOST_NAME}`,
    `HKEY_CURRENT_USER\\Software\\Chromium\\NativeMessagingHosts\\${ONEKEY_DESKTOP_NATIVE_MESSAGING_HOST_NAME}`,
    `HKEY_CURRENT_USER\\Software\\BraveSoftware\\Brave-Browser\\NativeMessagingHosts\\${ONEKEY_DESKTOP_NATIVE_MESSAGING_HOST_NAME}`,
    `HKEY_CURRENT_USER\\Software\\Microsoft\\Edge\\NativeMessagingHosts\\${ONEKEY_DESKTOP_NATIVE_MESSAGING_HOST_NAME}`,
  ];
}

function getWindowsManifestPath() {
  return path.join(
    app.getPath('userData'),
    'native-messaging-hosts',
    `${ONEKEY_DESKTOP_NATIVE_MESSAGING_HOST_NAME}.json`,
  );
}

async function registerWindowsNativeMessagingHost(manifestPath: string) {
  await Promise.all(
    getWindowsNativeMessagingRegistryKeys().map((registryKey) =>
      execFileAsync('reg.exe', [
        'ADD',
        registryKey,
        '/ve',
        '/t',
        'REG_SZ',
        '/d',
        manifestPath,
        '/f',
      ]),
    ),
  );
}

function writeHostScript(hostScriptPath: string) {
  fs.mkdirSync(path.dirname(hostScriptPath), { recursive: true });
  fs.writeFileSync(hostScriptPath, getHostScript(), { mode: 0o755 });
  if (process.platform !== 'win32') {
    fs.chmodSync(hostScriptPath, 0o755);
  }
}

function buildNativeMessagingManifestContent(params: {
  hostScriptPath: string;
  allowedExtensionIds: string[];
}): string {
  const manifest = {
    name: ONEKEY_DESKTOP_NATIVE_MESSAGING_HOST_NAME,
    description: 'OneKey Desktop Native Messaging Host',
    path: params.hostScriptPath,
    type: 'stdio',
    allowed_origins: params.allowedExtensionIds.map(
      (id) => `chrome-extension://${id}/`,
    ),
  };
  return JSON.stringify(manifest, null, 2);
}

function writeManifest(manifestPath: string, manifestContent: string) {
  fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
  fs.writeFileSync(manifestPath, manifestContent);
}

export async function ensureDesktopNativeMessagingHostManifest() {
  // Dev-only for now: don't touch user browser Native Messaging configs in
  // packaged/production builds until a real consumer ships. See the header of
  // @onekeyhq/shared/src/consts/desktopNativeMessaging for the security model
  // (same-user host impersonation risk) and the production checklist.
  if (!isDesktopDevRuntime()) {
    return;
  }
  // Experimental stage: macOS only (see desktopNativeMessaging.ts header). The
  // Linux/Windows install paths below remain as future scaffolding but are not
  // reached yet; MAS (App Store sandbox) is also excluded. Kept as an
  // array-membership test so the Windows/Linux branches below still type-check.
  if (!['darwin'].includes(process.platform) || process.mas) {
    return;
  }

  const allowedExtensionIds = getAllowedExtensionIds();
  if (!allowedExtensionIds.length) {
    logger.warn(
      '[NativeMessagingHost] skip install: no allowed extension ids configured',
    );
    return;
  }

  const hostScriptPath = getHostLauncherPath();
  writeHostScript(hostScriptPath);

  const manifestContent = buildNativeMessagingManifestContent({
    hostScriptPath,
    allowedExtensionIds,
  });

  if (process.platform === 'win32') {
    const manifestPath = getWindowsManifestPath();
    writeManifest(manifestPath, manifestContent);
    await registerWindowsNativeMessagingHost(manifestPath);
    return;
  }

  getNativeMessagingManifestDirs().forEach((manifestDir) => {
    // Isolate per-browser failures: a write error for one browser dir (perms,
    // disk) must not skip installing into the remaining browsers.
    try {
      writeManifest(
        path.join(
          manifestDir,
          `${ONEKEY_DESKTOP_NATIVE_MESSAGING_HOST_NAME}.json`,
        ),
        manifestContent,
      );
    } catch (error) {
      logger.warn(
        `[NativeMessagingHost] failed to write manifest to ${manifestDir}`,
        error,
      );
    }
  });
}
