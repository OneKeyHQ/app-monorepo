const { execSync } = require('child_process');

execSync(
  `sh -c 'npx tsc --noEmit --tsBuildInfoFile \"$(yarn config get cacheFolder)\"/.app-mono-ts-cache  --pretty'`,
);
