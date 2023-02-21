import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import type { Network } from '@onekeyhq/engine/src/types/network';
import { IMPL_FIL } from '@onekeyhq/shared/src/engine/engineConsts';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { openUrl } from '../utils/openUrl';

import { useNetworks } from './redux';

function fixBlockExplorerUrl(network: Network | null | undefined, url: string) {
  if (
    network?.impl === IMPL_FIL &&
    platformEnv.isNative &&
    !network.isTestnet
  ) {
    // filscan will change the domain to m.filsacn on the native, but does lose the parameters
    // Manually changing it to m.filscan can avoid parameter loss when converting
    return url.replace('filscan', 'm.filscan');
  }
  return url;
}

export function buildTransactionDetailsUrl(
  network: Network | null | undefined,
  txId: string | null | undefined,
) {
  if (!network || !txId) return '';
  const fixedUrl = fixBlockExplorerUrl(
    network,
    network.blockExplorerURL.transaction,
  );
  return fixedUrl.replace('{transaction}', txId);
}

export function buildAddressDetailsUrl(
  network: Network | null | undefined,
  address: string | null | undefined,
) {
  if (!network || !address) return '';
  const fixedUrl = fixBlockExplorerUrl(
    network,
    network.blockExplorerURL.address,
  );
  return fixedUrl.replace('{address}', address);
}

export function buildBlockDetailsUrl(
  network: Network | null | undefined,
  block: string | null | undefined,
) {
  if (!network || !block) return '';
  const fixedUrl = fixBlockExplorerUrl(network, network.blockExplorerURL.block);
  return fixedUrl.replace('{block}', block);
}

export default function useOpenBlockBrowser(
  network: Network | null | undefined,
) {
  const intl = useIntl();

  const networks = useNetworks();

  const hasAvailable = useMemo(() => {
    if (!network) return false;
    const currentNetwork = networks.find((x) => x.id === network.id);
    return !!currentNetwork?.blockExplorerURL?.address;
  }, [network, networks]);

  const openTransactionDetails = useCallback(
    (txId: string | null | undefined, title?: string) => {
      const url = buildTransactionDetailsUrl(network, txId);

      openUrl(
        url,
        title ?? intl.formatMessage({ id: 'transaction__transaction_details' }),
        {
          modalMode: true,
        },
      );
    },
    [intl, network],
  );

  const openAddressDetails = useCallback(
    (address: string | null | undefined, title?: string) => {
      const url = buildAddressDetailsUrl(network, address);

      openUrl(
        url,
        title ?? intl.formatMessage({ id: 'transaction__transaction_details' }),
        {
          modalMode: true,
        },
      );
    },
    [intl, network],
  );

  const openBlockDetails = useCallback(
    (txId: string | null | undefined, title?: string) => {
      const url = buildBlockDetailsUrl(network, txId);

      openUrl(
        url,
        title ?? intl.formatMessage({ id: 'transaction__transaction_details' }),
        {
          modalMode: true,
        },
      );
    },
    [intl, network],
  );

  return {
    hasAvailable,
    openTransactionDetails,
    openAddressDetails,
    openBlockDetails,
  };
}
