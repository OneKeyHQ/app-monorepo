import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { ToastManager } from '@onekeyhq/components';
import { copyToClipboard } from '@onekeyhq/components/src/utils/ClipboardUtils';
import type { Account } from '@onekeyhq/engine/src/types/account';
import type { Network } from '@onekeyhq/engine/src/types/network';
import type { Wallet } from '@onekeyhq/engine/src/types/wallet';

import {
  ModalRoutes,
  ReceiveTokenRoutes,
  RootRoutes,
} from '../routes/routesEnum';

import useNavigation from './useNavigation';

export function useCopyAddress({
  wallet,
  network,
  account,
}: {
  wallet: Wallet | null | undefined;
  network?: Network | null;
  account?: Account | null;
}) {
  const isHwWallet = wallet?.type === 'hw';
  const intl = useIntl();
  const navigation = useNavigation();

  const copyAddress = useCallback(
    (address?: string, template?: string, customPath?: string) => {
      if (isHwWallet) {
        navigation.navigate(RootRoutes.Modal, {
          screen: ModalRoutes.Receive,
          params: {
            screen: ReceiveTokenRoutes.ReceiveToken,
            params: {
              address,
              wallet,
              network,
              account,
              template,
              customPath,
            },
          },
        });
      } else {
        if (!address) return;
        copyToClipboard(address);
        ToastManager.show({
          title: intl.formatMessage({ id: 'msg__address_copied' }),
        });
      }
    },
    [account, intl, isHwWallet, navigation, network, wallet],
  );

  return {
    isHwWallet,
    copyAddress,
  };
}
