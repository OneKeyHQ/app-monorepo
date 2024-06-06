import type { ComponentProps } from 'react';
import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { useClipboard } from '@onekeyhq/components';
import { useReviewControl } from '@onekeyhq/kit/src/components/ReviewControl';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { openUrl } from '@onekeyhq/kit/src/utils/openUrl';
import { useSupportNetworkId } from '@onekeyhq/kit/src/views/FiatCrypto/hooks';
import {
  EModalFiatCryptoRoutes,
  EModalRoutes,
} from '@onekeyhq/shared/src/routes';
import { buildExplorerAddressUrl } from '@onekeyhq/shared/src/utils/uriUtils';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';

import { RawActions } from './RawActions';

export function WalletActionMore() {
  const {
    activeAccount: { account, network },
  } = useActiveAccount({ num: 0 });
  const intl = useIntl();
  const { copyText } = useClipboard();
  const navigation = useAppNavigation();
  const { result: isSupported } = useSupportNetworkId({
    networkId: network?.id ?? '',
    type: 'sell',
  });
  const sellCrypto = useCallback(() => {
    navigation.pushModal(EModalRoutes.FiatCryptoModal, {
      screen: EModalFiatCryptoRoutes.SellModal,
      params: { networkId: network?.id ?? '', accountId: account?.id ?? '' },
    });
  }, [navigation, network, account]);
  const show = useReviewControl();

  const sections: ComponentProps<typeof RawActions.More>['sections'] = [
    {
      items: [
        {
          label: intl.formatMessage({ id: 'action__view_in_explorer' }),
          icon: 'GlobusOutline',
          onPress: () =>
            openUrl(
              buildExplorerAddressUrl({
                network,
                address: account?.address,
              }),
            ),
        },
        {
          label: intl.formatMessage({ id: 'action__copy_address' }),
          icon: 'Copy1Outline',
          onPress: () => copyText(account?.address || ''),
        },
      ],
    },
  ];

  if (show) {
    sections.unshift({
      items: [
        {
          label: intl.formatMessage({ id: 'action__sell_crypto' }),
          icon: 'MinusLargeOutline',
          disabled: !isSupported,
          onPress: sellCrypto,
        },
      ],
    });
  }

  if (process.env.NODE_ENV !== 'production') {
    sections.unshift({
      items: [
        {
          label: 'Export Private Key',
          icon: 'MinusLargeOutline',
          onPress: () => {
            void (async () => {
              const r =
                await backgroundApiProxy.serviceAccount.exportAccountSecretKeys(
                  {
                    accountId: account?.id || '',
                    networkId: network?.id || '',
                  },
                );

              console.log(r);
            })();
          },
        },
      ],
    });
  }

  return <RawActions.More sections={sections} />;
}
