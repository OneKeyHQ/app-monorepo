import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Toast } from '@onekeyhq/components/src/Toast/useToast';
import { copyToClipboard } from '@onekeyhq/components/src/utils/ClipboardUtils';
import { Wallet } from '@onekeyhq/engine/src/types/wallet';

import { ReceiveTokenRoutes } from '../routes';
import { ModalRoutes, RootRoutes } from '../routes/routesEnum';

import useNavigation from './useNavigation';

export function useCopyAddress(wallet: Wallet | null) {
  const isHwWallet = wallet?.type === 'hw';
  const intl = useIntl();
  const navigation = useNavigation();

  const copyAddress = useCallback(
    (address?: string) => {
      if (isHwWallet) {
        navigation.navigate(RootRoutes.Modal, {
          screen: ModalRoutes.Receive,
          params: {
            screen: ReceiveTokenRoutes.ReceiveToken,
            params: {},
          },
        });
      } else {
        if (!address) return;
        copyToClipboard(address);
        Toast.show({
          title: intl.formatMessage({ id: 'msg__address_copied' }),
        });
      }
    },
    [intl, isHwWallet, navigation],
  );

  return {
    isHwWallet,
    copyAddress,
  };
}
