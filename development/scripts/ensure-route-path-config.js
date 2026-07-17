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

const routeSourceExtensions = ['.ts', '.tsx', '.mjs', '.js', '.jsx'];
const isRouteSourceFile = (filePath) =>
  routeSourceExtensions.some((extension) => filePath.endsWith(extension));
const normalizeWatchPath = (filePath) =>
  filePath?.toString().replaceAll('\\', '/');

const shouldWatchRoutePathConfig = (args = process.argv.slice(2)) =>
  args.some(
    (arg) =>
      arg === '--watch' ||
      arg === '--watch=true' ||
      arg === '--watchAll' ||
      arg === '--watchAll=true',
  );

const isViewRouterSourceFile = (filePath) => {
  if (!isRouteSourceFile(filePath)) {
    return false;
  }
  const segments = filePath.split('/');
  if (segments.includes('router')) {
    return true;
  }
  const fileName = segments.at(-1) || '';
  const extension = routeSourceExtensions.find((item) =>
    fileName.endsWith(item),
  );
  const baseName = extension ? fileName.slice(0, -extension.length) : fileName;
  return baseName.split('.')[0] === 'router';
};

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
      matches: isRouteSourceFile,
    },
    {
      directory: path.join(repoRoot, 'packages/kit/src/routes'),
      matches: (filePath) =>
        isRouteSourceFile(filePath) && !filePath.startsWith('generated/'),
    },
    {
      directory: path.join(repoRoot, 'packages/kit/src/views'),
      matches: isViewRouterSourceFile,
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
  isViewRouterSourceFile,
  shouldWatchRoutePathConfig,
  watchRoutePathConfig,
};
