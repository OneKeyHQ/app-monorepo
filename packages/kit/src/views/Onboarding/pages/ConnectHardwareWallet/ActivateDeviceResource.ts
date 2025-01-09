/* eslint-disable @typescript-eslint/no-unsafe-return */
import type { IDeviceType } from '@onekeyfe/hd-core';

export const getCreateNewWalletStepImage = (type: IDeviceType) => {
  switch (type) {
    case 'unknown':
      return Promise.resolve(null);
    case 'classic':
    case 'classic1s':
      return require('@onekeyhq/kit/assets/onboarding/classic-create-new-wallet.png');
    case 'mini':
      return require('@onekeyhq/kit/assets/onboarding/mini-create-new-wallet.png');
    case 'touch':
      return require('@onekeyhq/kit/assets/onboarding/touch-create-new-wallet.png');
    case 'pro':
      return require('@onekeyhq/kit/assets/onboarding/pro-create-new-wallet.png');
    default:
      // eslint-disable-next-line no-case-declarations, @typescript-eslint/no-unused-vars
      const _exhaustiveCheck: never = type;
  }
};

export const getWriteDownRecoveryPhraseStepImage = (type: IDeviceType) => {
  switch (type) {
    case 'unknown':
      return Promise.resolve(null);
    case 'classic':
    case 'classic1s':
      return require('@onekeyhq/kit/assets/onboarding/classic-write-down-recovery-phrase.png');
    case 'mini':
      return require('@onekeyhq/kit/assets/onboarding/mini-write-down-recovery-phrase.png');
    case 'touch':
      return require('@onekeyhq/kit/assets/onboarding/touch-write-down-recovery-phrase.png');
    case 'pro':
      return require('@onekeyhq/kit/assets/onboarding/pro-write-down-recovery-phrase.png');
    default:
      // eslint-disable-next-line no-case-declarations, @typescript-eslint/no-unused-vars
      const _exhaustiveCheck: never = type;
  }
};

export const getSetPinStepImage = (type: IDeviceType) => {
  switch (type) {
    case 'unknown':
      return Promise.resolve(null);
    case 'classic':
    case 'classic1s':
      return require('@onekeyhq/kit/assets/onboarding/classic-set-pin.png');
    case 'mini':
      return require('@onekeyhq/kit/assets/onboarding/mini-set-pin.png');
    case 'touch':
      return require('@onekeyhq/kit/assets/onboarding/touch-set-pin.png');
    case 'pro':
      return require('@onekeyhq/kit/assets/onboarding/pro-set-pin.png');
    default:
      // eslint-disable-next-line no-case-declarations, @typescript-eslint/no-unused-vars
      const _exhaustiveCheck: never = type;
  }
};

export const getImportWalletStepImage = (type: IDeviceType) => {
  switch (type) {
    case 'unknown':
      return Promise.resolve(null);
    case 'classic':
    case 'classic1s':
      return require('@onekeyhq/kit/assets/onboarding/classic-import-wallet.png');
    case 'mini':
      return require('@onekeyhq/kit/assets/onboarding/mini-import-wallet.png');
    case 'touch':
      return require('@onekeyhq/kit/assets/onboarding/touch-create-new-wallet.png');
    case 'pro':
      return require('@onekeyhq/kit/assets/onboarding/pro-create-new-wallet.png');
    default:
      // eslint-disable-next-line no-case-declarations, @typescript-eslint/no-unused-vars
      const _exhaustiveCheck: never = type;
  }
};

export const getEnterRecoveryPhraseStepImage = (type: IDeviceType) => {
  switch (type) {
    case 'unknown':
      return Promise.resolve(null);
    case 'classic':
    case 'classic1s':
      return require('@onekeyhq/kit/assets/onboarding/classic-enter-recovery-phrase.png');
    case 'mini':
      return require('@onekeyhq/kit/assets/onboarding/mini-enter-recovery-phrase.png');
    case 'touch':
      return require('@onekeyhq/kit/assets/onboarding/touch-enter-recovery-phrase.png');
    case 'pro':
      return require('@onekeyhq/kit/assets/onboarding/pro-enter-recovery-phrase.png');
    default:
      // eslint-disable-next-line no-case-declarations, @typescript-eslint/no-unused-vars
      const _exhaustiveCheck: never = type;
  }
};
