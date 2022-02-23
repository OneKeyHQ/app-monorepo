import { useCallback } from 'react';

import { useNavigation } from '@react-navigation/core';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useIntl } from 'react-intl';
import { Platform } from 'react-native';

import { Network } from '@onekeyhq/engine/src/types/network';

import { HomeRoutes, HomeRoutesParams } from '../routes/types';

function buildTransactionDetailsUrl(
  network: Network | null | undefined,
  txId: string | null | undefined,
) {
  if (!network || !txId) return '';
  return network.blockExplorerURL.transaction.replace('{transaction}', txId);
}

function buildAddressDetailsUrl(
  network: Network | null | undefined,
  address: string | null | undefined,
) {
  if (!network || !address) return '';
  return network.blockExplorerURL.address.replace('{address}', address);
}

function buildBlockDetailsUrl(
  network: Network | null | undefined,
  block: string | null | undefined,
) {
  if (!network || !block) return '';
  return network.blockExplorerURL.block.replace('{block}', block);
}

type NavigationProps = NativeStackNavigationProp<
  HomeRoutesParams,
  HomeRoutes.SettingsWebviewScreen
>;

export default function useOpenBlockBrowser(
  network: Network | null | undefined,
) {
  const navigation = useNavigation<NavigationProps>();
  const intl = useIntl();

  const openBlockBrowser = useCallback(
    (url: string, title?: string) => {
      if (['android', 'ios'].includes(Platform.OS)) {
        navigation.navigate(HomeRoutes.SettingsWebviewScreen, {
          url,
          title,
        });
      } else {
        window.open(url, '_blank');
      }
    },
    [navigation],
  );

  const openTransactionDetails = useCallback(
    (txId: string | null | undefined, title?: string) => {
      const url = buildTransactionDetailsUrl(network, txId);

      openBlockBrowser(
        url,
        title ?? intl.formatMessage({ id: 'transaction__transaction_details' }),
      );
    },
    [intl, network, openBlockBrowser],
  );

  const openAddressDetails = useCallback(
    (txId: string | null | undefined, title?: string) => {
      const url = buildAddressDetailsUrl(network, txId);

      openBlockBrowser(
        url,
        title ?? intl.formatMessage({ id: 'transaction__transaction_details' }),
      );
    },
    [intl, network, openBlockBrowser],
  );

  const openBlockDetails = useCallback(
    (txId: string | null | undefined, title?: string) => {
      const url = buildBlockDetailsUrl(network, txId);

      openBlockBrowser(
        url,
        title ?? intl.formatMessage({ id: 'transaction__transaction_details' }),
      );
    },
    [intl, network, openBlockBrowser],
  );

  return { openTransactionDetails, openAddressDetails, openBlockDetails };
}
