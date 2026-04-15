import { useCallback } from 'react';

import { Toast } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { parseOnChainAmount } from '@onekeyhq/kit/src/views/ScanQrCode/hooks/useParseQRCode';
import type { IChainValue } from '@onekeyhq/kit-bg/src/services/ServiceScanQRCode/utils/parseQRCode/type';
import {
  EModalRoutes,
  EModalSignatureConfirmRoutes,
} from '@onekeyhq/shared/src/routes';
import type { IToken } from '@onekeyhq/shared/types/token';

import { isBitrefillOrigin, parseBitrefillPaymentIntent } from '../utils/bitrefillHandler';

import type { IJsBridgeMessagePayload } from '@onekeyfe/cross-inpage-provider-types';

/**
 * Hook to handle Discovery WebView messages.
 * Filters for Bitrefill payment_intent events and pushes the Send modal
 * with pre-filled data so the user can confirm the transaction.
 */
export function useDiscoveryMessageHandler() {
  const navigation = useAppNavigation();
  const { activeAccount } = useActiveAccount({ num: 0 });

  const customReceiveHandler = useCallback(
    async (payload: IJsBridgeMessagePayload) => {
      if (!isBitrefillOrigin(payload.origin)) return;

      const message = parseBitrefillPaymentIntent(payload.data);
      if (!message) {
        // Non-payment_intent Bitrefill events (invoice_created/update/complete) — ignore silently
        return;
      }

      try {
        const result = await backgroundApiProxy.serviceScanQRCode.handlePaymentUri({
          uri: message.paymentUri,
        });

        const chainValue = result.data as IChainValue;
        const network = chainValue.network;
        if (!network) {
          throw new Error('paymentUri missing network context');
        }

        const accountId = activeAccount.account?.id;
        if (!accountId) {
          throw new Error('No active account');
        }

        let selectedToken: IToken | null = null;
        if (chainValue.tokenAddress) {
          selectedToken = await backgroundApiProxy.serviceToken.getToken({
            networkId: network.id,
            accountId,
            tokenIdOnNetwork: chainValue.tokenAddress,
          });
        }
        if (!selectedToken) {
          selectedToken = await backgroundApiProxy.serviceToken.getNativeToken({
            networkId: network.id,
            accountId,
          });
        }

        const amount = await parseOnChainAmount(result, selectedToken);

        navigation.pushModal(EModalRoutes.SignatureConfirmModal, {
          screen: EModalSignatureConfirmRoutes.TxDataInput,
          params: {
            accountId,
            networkId: network.id,
            activeAccountId: accountId,
            activeNetworkId: selectedToken?.networkId ?? network.id,
            isNFT: false,
            token: selectedToken,
            address: chainValue.address,
            amount,
          },
        });
      } catch (error) {
        // TODO(i18n): replace with ETranslations.bitrefill_payment_failed once the key lands upstream
        Toast.error({
          title: 'Unable to open payment. Please retry from Bitrefill.',
        });
      }
    },
    [activeAccount.account?.id, navigation],
  );

  return { customReceiveHandler };
}
