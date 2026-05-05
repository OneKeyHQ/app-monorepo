const fs = require('fs');

function fileExists(p) {
  try {
    return Boolean(p) && fs.existsSync(p);
  } catch {
    return false;
  }
}

function findChromiumExecutable(preferred) {
  if (fileExists(preferred)) return preferred;

  const env =
    process.env.PERF_CHROME_EXECUTABLE_PATH ||
    process.env.CHROME_EXECUTABLE_PATH ||
    null;
  if (fileExists(env)) return env;

  const candidates = [
    // Microsoft Edge (Chromium)
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    `${process.env.HOME}/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge`,
    '/Applications/Microsoft Edge Beta.app/Contents/MacOS/Microsoft Edge Beta',
    `${process.env.HOME}/Applications/Microsoft Edge Beta.app/Contents/MacOS/Microsoft Edge Beta`,
    '/Applications/Microsoft Edge Dev.app/Contents/MacOS/Microsoft Edge Dev',
    `${process.env.HOME}/Applications/Microsoft Edge Dev.app/Contents/MacOS/Microsoft Edge Dev`,
    '/Applications/Microsoft Edge Canary.app/Contents/MacOS/Microsoft Edge Canary',
    `${process.env.HOME}/Applications/Microsoft Edge Canary.app/Contents/MacOS/Microsoft Edge Canary`,
    // Google Chrome
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    `${process.env.HOME}/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`,
    // Chrome Canary
    '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
    `${process.env.HOME}/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary`,
    // Chromium
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    `${process.env.HOME}/Applications/Chromium.app/Contents/MacOS/Chromium`,
  ];

  for (const p of candidates) {
    if (fileExists(p)) return p;
  }

  return null;
}

module.exports = {
  findChromiumExecutable,
};
