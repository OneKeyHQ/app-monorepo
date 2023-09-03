import { useCallback } from 'react';

import type { ICON_NAMES } from '@onekeyhq/components';
import type { ThemeToken } from '@onekeyhq/components/src/Provider/theme';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useActiveSideAccount, useNavigation } from '../../../hooks';
import { useActionForAllNetworks } from '../../../hooks/useAllNetwoks';
import {
  FiatPayModalRoutes,
  ModalRoutes,
  RootRoutes,
} from '../../../routes/routesEnum';

export type ButtonsType = (params: {
  networkId: string;
  accountId: string;
}) => {
  visible: boolean;
  isDisabled: boolean;
  process: () => unknown;
  icon: ICON_NAMES;
  text: ThemeToken;
};

export const useFiatPay = ({
  networkId,
  accountId,
  type,
}: {
  networkId: string;
  accountId: string;
  type: 'buy' | 'sell';
}): ReturnType<ButtonsType> => {
  const { wallet } = useActiveSideAccount({
    networkId,
    accountId,
  });
  const navigation = useNavigation();
  const { visible, process } = useActionForAllNetworks({
    accountId,
    networkId,
    action: useCallback(
      ({ network: n, account: a }) => {
        navigation.navigate(RootRoutes.Modal, {
          screen: ModalRoutes.FiatPay,
          params: {
            screen: FiatPayModalRoutes.SupportTokenListModal,
            params: {
              type,
              networkId: n.id,
              accountId: a.id,
            },
          },
        });
      },
      [navigation, type],
    ),
    filter: (p) =>
      !platformEnv.isAppleStoreEnv &&
      wallet?.type !== 'watching' &&
      !!p.network &&
      !!p.account,
  });

  return {
    visible,
    process,
    isDisabled: !visible,
    icon: 'PlusMini',
    text: 'action__buy_crypto' as ThemeToken,
  };
};
