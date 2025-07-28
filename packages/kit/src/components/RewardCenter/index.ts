import type { IDialogShowProps, IKeyOfIcons } from '@onekeyhq/components';
import {
  IMPL_ALLNETWORKS,
  IMPL_TRON,
} from '@onekeyhq/shared/src/engine/engineConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';

import { showTronRewardCenter } from './TronRewardCenter';

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
  title: appLocale.intl.formatMessage({
    id: ETranslations.wallet_subsidy_redeem_title,
  }),
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

  const impl = networkUtils.getNetworkImpl({ networkId });

  switch (impl) {
    case IMPL_ALLNETWORKS:
    case IMPL_TRON:
      return {
        ...rewardCenterDefaultConfig,
        handler: () => showTronRewardCenter(props),
      };
    default:
      return null;
  }
};
