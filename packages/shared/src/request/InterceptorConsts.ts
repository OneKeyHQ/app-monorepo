import platformEnv from '../platformEnv';

// Be consistent with backend platform definition
// https://onekeyhq.atlassian.net/wiki/spaces/ONEKEY/pages/390266887#%E5%85%AC%E5%85%B1%E5%8F%82%E6%95%B0
export const headerPlatform = [platformEnv.appPlatform, platformEnv.appChannel]
  .filter(Boolean)
  .join('-');
