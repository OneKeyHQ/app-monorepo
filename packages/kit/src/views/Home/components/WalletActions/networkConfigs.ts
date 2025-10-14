import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';

import type { INetworkWalletActionsConfig } from './types';

const networkIds = getNetworkIdsMap();

export const defaultWalletActionsConfig: INetworkWalletActionsConfig = {
  mainActions: ['send', 'receive', 'swap'],
  moreActions: ['buy', 'sell', 'explorer', 'copy', 'sign', 'reward', 'export'],
  moreActionGroups: [
    {
      type: 'trading',
      actions: ['buy', 'sell'],
      order: 1,
    },
    {
      type: 'tools',
      actions: ['explorer', 'copy', 'sign', 'reward'],
      order: 2,
    },
    {
      type: 'developer',
      actions: ['export'],
      order: 3,
    },
  ],
};

export const detailedNetworkConfigs: Record<
  string,
  Partial<INetworkWalletActionsConfig>
> = {
  [networkIds.trx]: {
    mainActions: ['send', 'receive', 'staking'],
    moreActions: [
      'buy',
      'sell',
      'swap',
      'explorer',
      'copy',
      'sign',
      'reward',
      'export',
    ],
    moreActionGroups: [
      {
        type: 'trading',
        actions: ['buy', 'sell', 'swap'],
        order: 1,
      },
      {
        type: 'tools',
        actions: ['explorer', 'copy', 'sign', 'reward'],
        order: 2,
      },
      {
        type: 'developer',
        actions: ['export'],
        order: 3,
      },
    ],
    actionCustomization: {
      staking: {
        label: appLocale.intl.formatMessage({
          id: ETranslations.wallet_tron_trx_staking,
        }),
      },
    },
  },
};

// for feature user custom actions
export const userCustomConfigs: Record<
  string,
  Partial<INetworkWalletActionsConfig>
> = {};
