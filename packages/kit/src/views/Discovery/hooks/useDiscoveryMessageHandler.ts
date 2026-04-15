import { useCallback, useEffect, useRef } from 'react';

import { Toast } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { parseOnChainAmount } from '@onekeyhq/kit/src/views/ScanQrCode/hooks/useParseQRCode';
import { OneKeyError } from '@onekeyhq/shared/src/errors';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import { EModalSignatureConfirmRoutes } from '@onekeyhq/shared/src/routes/signatureConfirm';

import {
  BITREFILL_BRIDGE_METHOD,
  BITREFILL_EMBED_ORIGIN,
} from '../utils/bitrefillUtils';
import {
  isBitrefillOrigin,
  parseBitrefillPaymentIntent,
} from '../utils/bitrefillHandler';

import type { IChainValue } from '@onekeyhq/kit-bg/src/services/ServiceScanQRCode/utils/parseQRCode/type';
import type { IJsBridgeMessagePayload } from '@onekeyfe/cross-inpage-provider-types';
import { IInjectedProviderNames } from '@onekeyfe/cross-inpage-provider-types';

const BITREFILL_DAPP_SCOPE = IInjectedProviderNames.ethereum;

/**
 * Hook to handle Discovery WebView messages.
 * Filters for Bitrefill payment_intent events, ensures a DApp wallet connection
 * exists (prompting if needed), switches to the target network if required,
 * then opens the Send modal with pre-filled data.
 *
 * This mirrors the eth_switchEthereumChain pattern in ProviderApiEthereum.ts.
 */
export function useDiscoveryMessageHandler() {
  const navigation = useAppNavigation();
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
      let rawEvent: unknown = null;
      if (data?.method === BITREFILL_BRIDGE_METHOD) {
        rawEvent = Array.isArray(data.params) ? data.params[0] : null;
      } else {
        // Future-proof: if a platform ever delivers the raw postMessage directly
        // (e.g. web iframe path), try to parse it too.
        rawEvent = data;
      }

      // eslint-disable-next-line no-console
      console.log(
        `[Bitrefill:DEBUG][customReceiveHandler] entered ${JSON.stringify({
          origin: payload?.origin,
          bridged: data?.method === BITREFILL_BRIDGE_METHOD,
          rawEventPreview:
            typeof rawEvent === 'object' && rawEvent
              ? { event: (rawEvent as { event?: string }).event }
              : null,
        })}`,
      );

      const message = parseBitrefillPaymentIntent(rawEvent);
      // eslint-disable-next-line no-console
      console.log(
        `[Bitrefill:DEBUG][customReceiveHandler] after parse ${JSON.stringify({
          hasMessage: Boolean(message),
          event: message?.event,
          paymentUri: message?.paymentUri,
        })}`,
      );
      if (!message) {
        // Non-payment_intent Bitrefill events (invoice_created/update/complete) — ignore silently
        return;
      }

      // Mock request object for serviceDApp methods (they need origin + scope)
      const dappRequest: IJsBridgeMessagePayload = {
        origin: BITREFILL_EMBED_ORIGIN,
        scope: BITREFILL_DAPP_SCOPE,
      };

      try {
        // 1. Parse paymentUri to get target network + address + amount
        const result =
          await backgroundApiProxy.serviceScanQRCode.handlePaymentUri({
            uri: message.paymentUri,
          });
        const chainValue = result.data as IChainValue;
        const targetNetwork = chainValue.network;
        if (!targetNetwork) {
          throw new OneKeyError('paymentUri missing network context');
        }

        // 2. Check existing DApp connection
        let accountsInfo =
          await backgroundApiProxy.serviceDApp.dAppGetConnectedAccountsInfo(
            dappRequest,
          );
        // eslint-disable-next-line no-console
        console.log(
          `[Bitrefill:DEBUG] connected accounts pre-modal ${JSON.stringify({
            count: accountsInfo?.length ?? 0,
            first: accountsInfo?.[0]?.accountInfo,
          })}`,
        );

        // 3. If not connected, prompt the user
        if (!accountsInfo || accountsInfo.length === 0) {
          try {
            // eslint-disable-next-line no-console
            console.log(
              `[Bitrefill:DEBUG] opening connection modal ${JSON.stringify({
                origin: BITREFILL_EMBED_ORIGIN,
                scope: BITREFILL_DAPP_SCOPE,
              })}`,
            );
            await backgroundApiProxy.serviceDApp.openConnectionModal(
              dappRequest,
            );
            // eslint-disable-next-line no-console
            console.log('[Bitrefill:DEBUG] connection modal resolved');
          } catch (connectErr) {
            // eslint-disable-next-line no-console
            console.log(
              `[Bitrefill:DEBUG] connection modal rejected ${JSON.stringify({
                message: (connectErr as Error)?.message,
              })}`,
            );
            // User denied connection modal
            // TODO(i18n): replace with ETranslations.bitrefill_connect_required
            Toast.error({
              title: 'Please connect a wallet to continue the payment.',
            });
            return;
          }
          // Re-query after connection
          accountsInfo =
            await backgroundApiProxy.serviceDApp.dAppGetConnectedAccountsInfo(
              dappRequest,
            );
          // eslint-disable-next-line no-console
          console.log(
            `[Bitrefill:DEBUG] connected accounts post-modal ${JSON.stringify({
              count: accountsInfo?.length ?? 0,
              first: accountsInfo?.[0]?.accountInfo,
            })}`,
          );
          if (!accountsInfo || accountsInfo.length === 0) {
            throw new OneKeyError('No account after connection');
          }
        }

        // 4. Switch network if mismatch
        const currentNetworkId = accountsInfo[0]?.accountInfo?.networkId;
        // eslint-disable-next-line no-console
        console.log(
          `[Bitrefill:DEBUG] network comparison ${JSON.stringify({
            currentNetworkId,
            targetNetworkId: targetNetwork.id,
            needsSwitch: currentNetworkId !== targetNetwork.id,
          })}`,
        );
        if (currentNetworkId !== targetNetwork.id) {
          // eslint-disable-next-line no-console
          console.log('[Bitrefill:DEBUG] switching network');
          await backgroundApiProxy.serviceDApp.switchConnectedNetwork({
            origin: BITREFILL_EMBED_ORIGIN,
            scope: BITREFILL_DAPP_SCOPE,
            oldNetworkId: currentNetworkId,
            newNetworkId: targetNetwork.id,
          });
          // eslint-disable-next-line no-console
          console.log('[Bitrefill:DEBUG] switch resolved, re-querying accounts');
          // Re-query after network switch
          accountsInfo =
            await backgroundApiProxy.serviceDApp.dAppGetConnectedAccountsInfo(
              dappRequest,
            );
          // eslint-disable-next-line no-console
          console.log(
            `[Bitrefill:DEBUG] connected accounts post-switch ${JSON.stringify(
              {
                count: accountsInfo?.length ?? 0,
                first: accountsInfo?.[0]?.accountInfo,
              },
            )}`,
          );
          if (!accountsInfo || accountsInfo.length === 0) {
            throw new OneKeyError('No account after network switch');
          }
        }

        // 5. Resolve final account + network
        const finalAccountId = accountsInfo[0]?.accountInfo?.accountId;
        const finalNetworkId = accountsInfo[0]?.accountInfo?.networkId;
        // eslint-disable-next-line no-console
        console.log(
          `[Bitrefill:DEBUG] final account ${JSON.stringify({
            finalAccountId,
            finalNetworkId,
            mounted: isMountedRef.current,
          })}`,
        );
        if (!finalAccountId || !finalNetworkId) {
          throw new OneKeyError('Invalid connected account info');
        }

        if (!isMountedRef.current) return;

        // 6. Resolve token (ERC-20 or native)
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

        if (!isMountedRef.current) return;

        // 7. Parse amount and push Send modal
        const amount = await parseOnChainAmount(result, selectedToken);
        // eslint-disable-next-line no-console
        console.log(
          `[Bitrefill:DEBUG] about to pushModal ${JSON.stringify({
            accountId: finalAccountId,
            networkId: finalNetworkId,
            address: chainValue.address,
            amount,
            hasToken: Boolean(selectedToken),
            mounted: isMountedRef.current,
          })}`,
        );

        if (!isMountedRef.current) return;

        navigation.pushModal(EModalRoutes.SignatureConfirmModal, {
          screen: EModalSignatureConfirmRoutes.TxDataInput,
          params: {
            accountId: finalAccountId,
            networkId: finalNetworkId,
            activeAccountId: finalAccountId,
            activeNetworkId: selectedToken?.networkId || finalNetworkId,
            isNFT: false,
            token: selectedToken,
            address: chainValue.address,
            amount,
          },
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
    [navigation],
  );

  return { customReceiveHandler };
}
