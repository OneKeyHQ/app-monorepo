import {
  COINTYPE_LIGHTNING_TESTNET,
  INDEX_PLACEHOLDER,
} from '@onekeyhq/shared/src/engine/engineConsts';

import mainnetSettings from './settings';

import type { IVaultSettings } from '../../types';

const testnetSettings: IVaultSettings = Object.freeze({
  ...mainnetSettings,
  accountNameInfo: {
    default: {
      prefix: 'TLightning',
      category: `44'/${COINTYPE_LIGHTNING_TESTNET}'`,
      template: `m/44'/${COINTYPE_LIGHTNING_TESTNET}'/${INDEX_PLACEHOLDER}'/0/0`,
      coinType: COINTYPE_LIGHTNING_TESTNET,
    },
  },
});

export default testnetSettings;
