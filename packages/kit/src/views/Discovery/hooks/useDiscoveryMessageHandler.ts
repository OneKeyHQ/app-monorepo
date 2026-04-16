import { useCallback, useEffect, useRef } from 'react';

import {
  IInjectedProviderNames,
  type IJsBridgeMessagePayload,
} from '@onekeyfe/cross-inpage-provider-types';

import { Toast } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { parseOnChainAmount } from '@onekeyhq/kit/src/views/ScanQrCode/hooks/useParseQRCode';
import type { IChainValue } from '@onekeyhq/kit-bg/src/services/ServiceScanQRCode/utils/parseQRCode/type';
import { OneKeyError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type { IBitrefillFailStep } from '@onekeyhq/shared/src/logger/scopes/discovery/scenes/bitrefill';

import {
  isBitrefillOrigin,
  parseBitrefillPaymentIntent,
} from '../utils/bitrefillHandler';
import {
  BITREFILL_BRIDGE_METHOD,
  BITREFILL_EMBED_ORIGIN,
} from '../utils/bitrefillUtils';

const BITREFILL_DAPP_SCOPE = IInjectedProviderNames.ethereum;

// EIP-1193 user-rejected-request code. Also what web3Errors.provider
// .userRejectedRequest() emits when a dApp connection modal is closed.
const USER_REJECTED_CODE = 4001;

function isUserRejectedError(error: unknown): boolean {
  const code = (error as { code?: number } | null | undefined)?.code;
  return code === USER_REJECTED_CODE;
}

class BitrefillStepError extends OneKeyError {
  step: IBitrefillFailStep;

  constructor(step: IBitrefillFailStep, message: string) {
    super(message);
    this.step = step;
  }
}

/**
 * Hook to handle Discovery WebView messages.
 * Filters for Bitrefill payment_intent events, ensures a DApp wallet connection
 * exists (prompting if needed), switches to the target network if required,
 * builds the on-chain transaction from the paymentUri, then opens the DApp
 * signature-and-send modal so the user just confirms the pre-built tx.
 *
 * Trust boundary: we trust postMessages coming from `embed.bitrefill.com`
 * and rely on the user's final confirmation in the sign-and-send modal
 * (recipient / amount / network) as the last safety net.
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
        let chainValue: IChainValue;
        let result: Awaited<
          ReturnType<
            typeof backgroundApiProxy.serviceScanQRCode.handlePaymentUri
          >
        >;
        try {
          result = await backgroundApiProxy.serviceScanQRCode.handlePaymentUri({
            uri: message.paymentUri,
          });
          chainValue = result.data as IChainValue;
        } catch (e) {
          throw new BitrefillStepError(
            'handlePaymentUri',
            (e as Error)?.message ?? 'handlePaymentUri failed',
          );
        }
        const targetNetwork = chainValue.network;
        if (!targetNetwork) {
          throw new BitrefillStepError(
            'handlePaymentUri',
            'paymentUri missing network context',
          );
        }

        defaultLogger.discovery.bitrefill.paymentIntentReceived({
          networkId: targetNetwork.id,
          tokenAddress: chainValue.tokenAddress,
        });

        // 2. Ensure connected account — prompt user if not yet connected.
        //    If multiple accounts are already connected for this origin, we
        //    force a clean reconnect so the user explicitly picks the one
        //    that should pay. Multiple-account fallthrough would otherwise
        //    silently default to accountsInfo[0].
        let accountsInfo =
          await backgroundApiProxy.serviceDApp.dAppGetConnectedAccountsInfo(
            dappRequest,
          );
        if (accountsInfo && accountsInfo.length > 1) {
          defaultLogger.discovery.bitrefill.walletReconnectTriggered({
            reason: 'multiAccount',
            connectedCount: accountsInfo.length,
          });
          try {
            await backgroundApiProxy.serviceDApp.disconnectWebsite({
              origin: BITREFILL_EMBED_ORIGIN,
              storageType: 'injectedProvider',
              beforeConnect: true,
              entry: 'Browser',
            });
          } catch (e) {
            throw new BitrefillStepError(
              'connectWallet',
              (e as Error)?.message ?? 'disconnect before reconnect failed',
            );
          }
          if (!isMountedRef.current) return;
          accountsInfo = null;
        }
        if (!accountsInfo || accountsInfo.length === 0) {
          try {
            await backgroundApiProxy.serviceDApp.openConnectionModal(
              dappRequest,
            );
          } catch (err) {
            if (isUserRejectedError(err)) {
              // User closed the connection modal on purpose — stay silent,
              // they can retry from Bitrefill's Pay button when ready.
              defaultLogger.discovery.bitrefill.userRejectedConnect();
              return;
            }
            throw new BitrefillStepError(
              'connectWallet',
              (err as Error)?.message ?? 'openConnectionModal failed',
            );
          }
          if (!isMountedRef.current) return;
          accountsInfo =
            await backgroundApiProxy.serviceDApp.dAppGetConnectedAccountsInfo(
              dappRequest,
            );
          if (!accountsInfo || accountsInfo.length === 0) {
            throw new BitrefillStepError(
              'connectWallet',
              'no account after connection',
            );
          }
        }

        // 3. Switch network if mismatch
        const currentNetworkId = accountsInfo[0]?.accountInfo?.networkId;
        if (currentNetworkId !== targetNetwork.id) {
          try {
            await backgroundApiProxy.serviceDApp.switchConnectedNetwork({
              origin: BITREFILL_EMBED_ORIGIN,
              scope: BITREFILL_DAPP_SCOPE,
              oldNetworkId: currentNetworkId,
              newNetworkId: targetNetwork.id,
            });
          } catch (e) {
            throw new BitrefillStepError(
              'switchNetwork',
              (e as Error)?.message ?? 'switchConnectedNetwork failed',
            );
          }
          if (!isMountedRef.current) return;
          accountsInfo =
            await backgroundApiProxy.serviceDApp.dAppGetConnectedAccountsInfo(
              dappRequest,
            );
          if (!accountsInfo || accountsInfo.length === 0) {
            throw new BitrefillStepError(
              'switchNetwork',
              'no account after network switch',
            );
          }
        }

        // 4. Resolve final connection state
        const finalAccountId = accountsInfo[0]?.accountInfo?.accountId;
        const finalNetworkId = accountsInfo[0]?.accountInfo?.networkId;
        const senderAddress =
          accountsInfo[0]?.account?.addressDetail?.normalizedAddress;
        if (!finalAccountId || !finalNetworkId || !senderAddress) {
          throw new BitrefillStepError(
            'resolveAccount',
            'invalid connected account info',
          );
        }

        if (!isMountedRef.current) return;

        // 5. Resolve token (native or ERC-20) — use vault-registered metadata so
        //    decimals/isNative are trustworthy even if Bitrefill sends unknown tokens
        let selectedToken = null;
        try {
          if (chainValue.tokenAddress) {
            selectedToken = await backgroundApiProxy.serviceToken.getToken({
              networkId: finalNetworkId,
              accountId: finalAccountId,
              tokenIdOnNetwork: chainValue.tokenAddress,
            });
          }
          if (!selectedToken) {
            selectedToken =
              await backgroundApiProxy.serviceToken.getNativeToken({
                networkId: finalNetworkId,
                accountId: finalAccountId,
              });
          }
        } catch (e) {
          throw new BitrefillStepError(
            'resolveToken',
            (e as Error)?.message ?? 'resolveToken failed',
          );
        }
        if (!selectedToken) {
          throw new BitrefillStepError(
            'resolveToken',
            'could not resolve token for payment',
          );
        }

        if (!isMountedRef.current) return;

        // 6. Build encodedTx through the EVM vault — handles ERC-20 ABI encoding
        //    and native value conversion with BigNumber precision (no float math)
        let unsignedTx: Awaited<
          ReturnType<typeof backgroundApiProxy.serviceSend.buildUnsignedTx>
        >;
        try {
          const amount = await parseOnChainAmount(result, selectedToken);
          unsignedTx = await backgroundApiProxy.serviceSend.buildUnsignedTx({
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
        } catch (e) {
          throw new BitrefillStepError(
            'buildUnsignedTx',
            (e as Error)?.message ?? 'buildUnsignedTx failed',
          );
        }

        if (!isMountedRef.current) return;

        // 7. Open signature-and-send modal (same path as eth_sendTransaction)
        try {
          await backgroundApiProxy.serviceDApp.openSignAndSendTransactionModal({
            request: dappRequest,
            encodedTx: unsignedTx.encodedTx,
            accountId: finalAccountId,
            networkId: finalNetworkId,
            transfersInfo: unsignedTx.transfersInfo,
          });
        } catch (e) {
          if (isUserRejectedError(e)) {
            // User rejected the tx — nothing to surface.
            return;
          }
          throw new BitrefillStepError(
            'openSignModal',
            (e as Error)?.message ?? 'openSignAndSendTransactionModal failed',
          );
        }
      } catch (error) {
        const step: IBitrefillFailStep =
          error instanceof BitrefillStepError ? error.step : 'unknown';
        defaultLogger.discovery.bitrefill.paymentIntentFailed({
          step,
          message: (error as Error)?.message ?? String(error),
        });
        Toast.error({
          title: ETranslations.browser_unable_to_pay,
        });
      }
    },
    [],
  );

  return { customReceiveHandler };
}
