import platformEnv from '@onekeyhq/shared/src/platformEnv';

export const LibLoader = async () => {
  if (platformEnv.isExtFirefox) {
    return null;
  }
  return import('cardano-coin-selection-asmjs');
};
