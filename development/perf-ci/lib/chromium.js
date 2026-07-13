const fs = require('fs');
const path = require('path');

// cspell:ignore LOCALAPPDATA

function fileExists(p) {
  try {
    return Boolean(p) && fs.existsSync(p);
  } catch {
    return false;
  }
}

function getChromiumExecutableCandidates(
  env = process.env,
  platform = process.platform,
) {
  const windowsCandidates =
    platform === 'win32'
      ? [
          path.win32.join(
            env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)',
            'Google',
            'Chrome',
            'Application',
            'chrome.exe',
          ),
          path.win32.join(
            env.PROGRAMFILES || 'C:\\Program Files',
            'Google',
            'Chrome',
            'Application',
            'chrome.exe',
          ),
          env.LOCALAPPDATA
            ? path.win32.join(
                env.LOCALAPPDATA,
                'Google',
                'Chrome',
                'Application',
                'chrome.exe',
              )
            : null,
          path.win32.join(
            env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)',
            'Microsoft',
            'Edge',
            'Application',
            'msedge.exe',
          ),
          path.win32.join(
            env.PROGRAMFILES || 'C:\\Program Files',
            'Microsoft',
            'Edge',
            'Application',
            'msedge.exe',
          ),
          env.LOCALAPPDATA
            ? path.win32.join(
                env.LOCALAPPDATA,
                'Microsoft',
                'Edge',
                'Application',
                'msedge.exe',
              )
            : null,
        ]
      : [];

  return [
    ...windowsCandidates,
    // Microsoft Edge (Chromium)
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    env.HOME
      ? `${env.HOME}/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge`
      : null,
    '/Applications/Microsoft Edge Beta.app/Contents/MacOS/Microsoft Edge Beta',
    env.HOME
      ? `${env.HOME}/Applications/Microsoft Edge Beta.app/Contents/MacOS/Microsoft Edge Beta`
      : null,
    '/Applications/Microsoft Edge Dev.app/Contents/MacOS/Microsoft Edge Dev',
    env.HOME
      ? `${env.HOME}/Applications/Microsoft Edge Dev.app/Contents/MacOS/Microsoft Edge Dev`
      : null,
    '/Applications/Microsoft Edge Canary.app/Contents/MacOS/Microsoft Edge Canary',
    env.HOME
      ? `${env.HOME}/Applications/Microsoft Edge Canary.app/Contents/MacOS/Microsoft Edge Canary`
      : null,
    // Google Chrome
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    env.HOME
      ? `${env.HOME}/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`
      : null,
    // Chrome Canary
    '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
    env.HOME
      ? `${env.HOME}/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary`
      : null,
    // Chromium
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    env.HOME
      ? `${env.HOME}/Applications/Chromium.app/Contents/MacOS/Chromium`
      : null,
    // Linux CI images, including GitHub-hosted Ubuntu runners.
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/opt/google/chrome/chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/snap/bin/chromium',
  ].filter(Boolean);
}

function findChromiumExecutable(preferred) {
  if (fileExists(preferred)) return preferred;

  const env =
    process.env.PERF_CHROME_EXECUTABLE_PATH ||
    process.env.CHROME_EXECUTABLE_PATH ||
    null;
  if (fileExists(env)) return env;

  const candidates = getChromiumExecutableCandidates();

  for (const p of candidates) {
    if (fileExists(p)) return p;
  }

  return null;
}

module.exports = {
  findChromiumExecutable,
  getChromiumExecutableCandidates,
};
