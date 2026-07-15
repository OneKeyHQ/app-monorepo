const fs = require('node:fs');
const path = require('node:path');

const { generateRoutePathConfig } = require('./compile-route-path-config');

const repoRoot = path.resolve(__dirname, '../..');
const routeWatchers = new Map();

const ensureRoutePathConfig = (targetNames) => {
  const result = generateRoutePathConfig({
    targetNames,
    silent: true,
  });
  if (result.durationMs > 0) {
    console.log(
      `[routes] Generated ${result.targets.join(', ')} cold-start config in ${result.durationMs.toFixed(0)} ms.`,
    );
  }
  return result;
};

const isTypeScriptFile = (filePath) => /\.tsx?$/u.test(filePath);
const normalizeWatchPath = (filePath) =>
  filePath?.toString().replaceAll('\\', '/');

const watchRoutePathConfig = (targetNames) => {
  if (process.env.NODE_ENV === 'production') {
    return;
  }
  const watcherKey = targetNames.toSorted().join(',');
  if (routeWatchers.has(watcherKey)) {
    return;
  }

  let refreshTimer;
  const scheduleRefresh = () => {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => {
      try {
        const result = generateRoutePathConfig({
          targetNames,
          silent: true,
          force: true,
        });
        console.log(
          `[routes] Refreshed ${result.targets.join(', ')} cold-start config in ${result.durationMs.toFixed(0)} ms.`,
        );
      } catch (error) {
        console.error('[routes] Failed to refresh cold-start config.', error);
      }
    }, 50);
    refreshTimer.unref();
  };

  const watchRoots = [
    {
      directory: path.join(repoRoot, 'packages/shared/src/routes'),
      matches: isTypeScriptFile,
    },
    {
      directory: path.join(repoRoot, 'packages/kit/src/routes'),
      matches: (filePath) =>
        isTypeScriptFile(filePath) && !filePath.startsWith('generated/'),
    },
    {
      directory: path.join(repoRoot, 'packages/kit/src/views'),
      matches: (filePath) =>
        isTypeScriptFile(filePath) &&
        /(?:^|\/)router(?:\/|(?:\.[^/]+)*\.tsx?$)/u.test(filePath),
    },
  ];
  const watchers = watchRoots.map(({ directory, matches }) => {
    const watcher = fs.watch(
      directory,
      { recursive: true },
      (_eventType, fileName) => {
        const filePath = normalizeWatchPath(fileName);
        if (filePath && matches(filePath)) {
          scheduleRefresh();
        }
      },
    );
    watcher.on('error', (error) => {
      console.error(`[routes] Failed to watch ${directory}.`, error);
    });
    watcher.unref();
    return watcher;
  });
  routeWatchers.set(watcherKey, watchers);
};

module.exports = {
  ensureRoutePathConfig,
  watchRoutePathConfig,
};
