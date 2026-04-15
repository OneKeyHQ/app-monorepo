import { useCallback, useEffect, useRef } from 'react';

import {
  IInjectedProviderNames,
  type IJsBridgeMessagePayload,
} from '@onekeyfe/cross-inpage-provider-types';

import { Toast } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { parseOnChainAmount } from '@onekeyhq/kit/src/views/ScanQrCode/hooks/useParseQRCode';
import { OneKeyError } from '@onekeyhq/shared/src/errors';

import {
  BITREFILL_BRIDGE_METHOD,
  BITREFILL_EMBED_ORIGIN,
} from '../utils/bitrefillUtils';
import {
  isBitrefillOrigin,
  parseBitrefillPaymentIntent,
} from '../utils/bitrefillHandler';

import type { IChainValue } from '@onekeyhq/kit-bg/src/services/ServiceScanQRCode/utils/parseQRCode/type';

const BITREFILL_DAPP_SCOPE = IInjectedProviderNames.ethereum;

/**
 * Hook to handle Discovery WebView messages.
 * Filters for Bitrefill payment_intent events, ensures a DApp wallet connection
 * exists (prompting if needed), switches to the target network if required,
 * builds the on-chain transaction from the paymentUri, then opens the DApp
 * signature-and-send modal so the user just confirms the pre-built tx.
 *
 * This mirrors eth_sendTransaction semantics — Bitrefill already defines all
 * payment parameters (recipient, token, amount) so we skip the Send form.
 */
export function useDiscoveryMessageHandler() {
  const isMountedRef = useRef(true);
  useEffect(
    () => () => {
      isMountedRef.current = false;
    },
    [],
  );

  const customReceiveHandler = useCallback(
    async (payload: IJsBridgeMessagePayload) => {
      if (!isBitrefillOrigin(payload.origin)) return;

      // Bitrefill raw window.postMessage does not flow through JSBridge. The
      // webview page is injected with a bridge script (see BITREFILL_BRIDGE_SCRIPT)
      // that re-emits each postMessage as $private/wallet_bitrefillEvent, which
      // arrives here as a JSBridge REQUEST. Unwrap params[0] to get the original
      // Bitrefill event payload.
      const data = payload.data as
        | { method?: string; params?: unknown[] }
        | undefined;
      if (data?.method !== BITREFILL_BRIDGE_METHOD) return;

      const rawEvent = Array.isArray(data.params) ? data.params[0] : null;
      const message = parseBitrefillPaymentIntent(rawEvent);
      if (!message) {
        // Non-payment_intent Bitrefill events (invoice_created/update/complete) — ignore silently
        return;
      }

      const dappRequest: IJsBridgeMessagePayload = {
        origin: BITREFILL_EMBED_ORIGIN,
        scope: BITREFILL_DAPP_SCOPE,
      };

      try {
        // 1. Parse paymentUri → recipient / tokenAddress / amount / network
        const result =
          await backgroundApiProxy.serviceScanQRCode.handlePaymentUri({
            uri: message.paymentUri,
          });
        const chainValue = result.data as IChainValue;
        const targetNetwork = chainValue.network;
        if (!targetNetwork) {
          throw new OneKeyError('paymentUri missing network context');
        }

        // 2. Ensure connected account — prompt user if not yet connected
        let accountsInfo =
          await backgroundApiProxy.serviceDApp.dAppGetConnectedAccountsInfo(
            dappRequest,
          );
        if (!accountsInfo || accountsInfo.length === 0) {
          try {
            await backgroundApiProxy.serviceDApp.openConnectionModal(
              dappRequest,
            );
          } catch {
            // TODO(i18n): replace with ETranslations.bitrefill_connect_required
            Toast.error({
              title: 'Please connect a wallet to continue the payment.',
            });
            return;
          }
          accountsInfo =
            await backgroundApiProxy.serviceDApp.dAppGetConnectedAccountsInfo(
              dappRequest,
            );
          if (!accountsInfo || accountsInfo.length === 0) {
            throw new OneKeyError('No account after connection');
          }
        }

        // 3. Switch network if mismatch
        const currentNetworkId = accountsInfo[0]?.accountInfo?.networkId;
        if (currentNetworkId !== targetNetwork.id) {
          await backgroundApiProxy.serviceDApp.switchConnectedNetwork({
            origin: BITREFILL_EMBED_ORIGIN,
            scope: BITREFILL_DAPP_SCOPE,
            oldNetworkId: currentNetworkId,
            newNetworkId: targetNetwork.id,
          });
          accountsInfo =
            await backgroundApiProxy.serviceDApp.dAppGetConnectedAccountsInfo(
              dappRequest,
            );
          if (!accountsInfo || accountsInfo.length === 0) {
            throw new OneKeyError('No account after network switch');
          }
        }

        // 4. Resolve final connection state
        const finalAccountId = accountsInfo[0]?.accountInfo?.accountId;
        const finalNetworkId = accountsInfo[0]?.accountInfo?.networkId;
        const senderAddress =
          accountsInfo[0]?.account?.addressDetail?.normalizedAddress;
        if (!finalAccountId || !finalNetworkId || !senderAddress) {
          throw new OneKeyError('Invalid connected account info');
        }

        if (!isMountedRef.current) return;

        // 5. Resolve token (native or ERC-20) — use vault-registered metadata so
        //    decimals/isNative are trustworthy even if Bitrefill sends unknown tokens
        let selectedToken = null;
        if (chainValue.tokenAddress) {
          selectedToken = await backgroundApiProxy.serviceToken.getToken({
            networkId: finalNetworkId,
            accountId: finalAccountId,
            tokenIdOnNetwork: chainValue.tokenAddress,
          });
        }
        if (!selectedToken) {
          selectedToken = await backgroundApiProxy.serviceToken.getNativeToken({
            networkId: finalNetworkId,
            accountId: finalAccountId,
          });
        }
        if (!selectedToken) {
          throw new OneKeyError('Could not resolve token for payment');
        }

        if (!isMountedRef.current) return;

        // 6. Build encodedTx through the EVM vault — handles ERC-20 ABI encoding
        //    and native value conversion with BigNumber precision (no float math)
        const amount = await parseOnChainAmount(result, selectedToken);
        const unsignedTx = await backgroundApiProxy.serviceSend.buildUnsignedTx({
          networkId: finalNetworkId,
          accountId: finalAccountId,
          transfersInfo: [
            {
              from: senderAddress,
              to: chainValue.address,
              amount,
              tokenInfo: selectedToken,
            },
          ],
        });

        if (!isMountedRef.current) return;

        // 7. Open signature-and-send modal (same path as eth_sendTransaction)
        await backgroundApiProxy.serviceDApp.openSignAndSendTransactionModal({
          request: dappRequest,
          encodedTx: unsignedTx.encodedTx,
          accountId: finalAccountId,
          networkId: finalNetworkId,
          transfersInfo: unsignedTx.transfersInfo,
        });
      } catch (error) {
        // TODO(logging): replace with defaultLogger.discovery.bitrefill once a scope exists
        // eslint-disable-next-line no-console
        console.error('[Bitrefill] payment_intent handler failed:', error);
        // TODO(i18n): replace with ETranslations.bitrefill_payment_failed once the key lands upstream
        Toast.error({
          title: 'Unable to open payment. Please retry from Bitrefill.',
        });
      }
    },
    [],
  );

  return { customReceiveHandler };
}
