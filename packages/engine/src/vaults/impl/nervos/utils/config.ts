import {
  getConfig as getSDKConfig,
  initializeConfig,
  predefined,
} from '@ckb-lumos/config-manager';

import type { Config } from '@ckb-lumos/config-manager';

export function initCustomConfig(chainId: string) {
  let config: Config;
  if (chainId === 'mainnet') {
    config = {
      ...predefined.LINA,
      SCRIPTS: {
        ...predefined.LINA.SCRIPTS,
        XUDT: {
          CODE_HASH:
            '0x50bd8d6680b8b9cf98b73f3c08faf8b2a21914311954118ad6609be6e78a1b95',
          HASH_TYPE: 'data1',
          TX_HASH:
            '0xc07844ce21b38e4b071dd0e1ee3b0e27afd8d7532491327f39b786343f558ab7',
          INDEX: '0x0',
          DEP_TYPE: 'code',
        },
      },
    };
  } else {
    config = {
      ...predefined.AGGRON4,
      SCRIPTS: {
        ...predefined.AGGRON4.SCRIPTS,
        XUDT: {
          CODE_HASH:
            '0x25c29dc317811a6f6f3985a7a9ebc4838bd388d19d0feeecf0bcd60f6c0975bb',
          HASH_TYPE: 'data1',
          TX_HASH:
            '0xbf6fb538763efec2a70a6a3dcb7242787087e1030c4e7d86585bc63a9d337f5f',
          INDEX: '0x0',
          DEP_TYPE: 'code',
        },
      },
    };
  }
  initializeConfig(config);
}

export function getConfig(chainId: string) {
  const config = getSDKConfig();
  if (chainId === 'mainnet' && config.PREFIX === 'ckb') {
    return config;
  }
  if (chainId === 'testnet' && config.PREFIX === 'ckt') {
    return config;
  }

  throw new Error('Invalid chainId');
}
