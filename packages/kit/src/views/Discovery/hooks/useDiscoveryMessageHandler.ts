import { useCallback } from 'react';

import { Toast } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import type {
  IChainValue,
  IEthereumValue,
} from '@onekeyhq/kit-bg/src/services/ServiceScanQRCode/utils/parseQRCode/type';
import {
  EModalRoutes,
  EModalSignatureConfirmRoutes,
} from '@onekeyhq/shared/src/routes';
import chainValueUtils from '@onekeyhq/shared/src/utils/chainValueUtils';
import { EQRCodeHandlerType } from '@onekeyhq/shared/types/qrCode';
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

        // Resolve amount — mirrors parseOnChainAmount logic for ETHEREUM URIs
        const ethValue = result.data as IEthereumValue;
        let amount = '';
        if (result.type === EQRCodeHandlerType.ETHEREUM) {
          if (ethValue.value) {
            // will be resolved below once token decimals are known
          } else if (ethValue.amount) {
            amount = String(ethValue.amount);
          }
        } else {
          amount = chainValue.amount ? String(chainValue.amount) : '';
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

        // If there's a raw chain value (e.g. wei), convert to display amount now that we have the token
        if (!amount && ethValue.value && selectedToken) {
          amount = chainValueUtils.convertTokenChainValueToAmount({
            value: ethValue.value,
            token: selectedToken,
          });
        }

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
