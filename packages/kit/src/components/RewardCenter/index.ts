import type { IDialogShowProps, IKeyOfIcons } from '@onekeyhq/components';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';

import { showTronRewardCenter } from './TronRewardCenter';

const networkIdsMap = getNetworkIdsMap();

export type IRewardCenterConfig = {
  title: string;
  icon: IKeyOfIcons;
  handler: (
    props: IDialogShowProps & {
      accountId: string;
      networkId: string;
    },
  ) => void;
};

const rewardCenterDefaultConfig: IRewardCenterConfig = {
  title: 'Subsidy/Redeem',
  icon: 'GiftOutline',
  handler: () => {},
};

export const getRewardCenterConfig = (
  props: IDialogShowProps & {
    accountId: string;
    networkId: string;
  },
) => {
  const { networkId } = props;

  switch (networkId) {
    case networkIdsMap.trx:
      return {
        ...rewardCenterDefaultConfig,
        handler: () => showTronRewardCenter(props),
      };
    default:
      return null;
  }
};
