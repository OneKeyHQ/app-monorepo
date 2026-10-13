import { Toast } from '@onekeyhq/components';
import type {
  ITransferInfo,
  ITransferPayload,
} from '@onekeyhq/kit-bg/src/vaults/types';
import { EBinanceDepositLocalErrorCode } from '@onekeyhq/shared/src/consts/binanceDepositConsts';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type { BinanceDepositScene } from '@onekeyhq/shared/src/logger/scopes/fiatCrypto/scenes/binanceDeposit';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import {
  getBinanceDepositAssetBlockReason,
  isBinanceDepositSessionClosed,
  maskBinanceDepositSessionId,
  maskBinanceDepositTxHash,
} from '@onekeyhq/shared/src/utils/binanceDepositUtils';
import { getBadgeQueryTokenAddress } from '@onekeyhq/shared/src/utils/cexDepositSupportUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import tokenRebaseUtils from '@onekeyhq/shared/src/utils/tokenRebaseUtils';
import { EBinanceDepositSessionStatus } from '@onekeyhq/shared/types/exchange';
import type {
  IBinanceDepositAssetBlockReason,
  IBinanceDepositSessionSnapshot,
} from '@onekeyhq/shared/types/exchange';
import type {
  IFetchTokenDetailItem,
  IToken,
} from '@onekeyhq/shared/types/token';
import type { ISendTxOnSuccessData } from '@onekeyhq/shared/types/tx';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { confirmCexDepositIfUnsupported } from '../../components/AddressInput/confirmCexDepositIfUnsupported';
import { showSimilarAddressDialog } from '../SignatureConfirm/components/SimilarAddressDialog/SimilarAddressDialog';

import {
  getBinanceDepositAddressRejectText,
  getBinanceDepositAmountRejectText,
  getBinanceDepositErrorCode,
  getBinanceDepositErrorText,
  isSameBinanceDepositAddress,
  normalizeBinanceDepositTxHash,
  validateBinanceDepositAmount,
} from './utils';

import type { useSignatureConfirm } from '../../hooks/useSignatureConfirm';
import type { IntlShape } from 'react-intl';

export type IBinanceDepositSendNotice = {
  type: 'critical' | 'info' | 'success' | 'warning';
  text: string;
};

export type IBinanceDepositSendResultLog = Parameters<
  BinanceDepositScene['sendResult']
>[0];

export type IBinanceDepositSendFlowParams = {
  session: IBinanceDepositSessionSnapshot;
  amountInput: string;
  // Both from the supported-assets list; undefined when the list is not
  // loaded or no longer carries the asset.
  requiresAddressTag?: boolean;
  depositDust?: string;
  // The list is loaded and carries the asset of the session. Only then does
  // a missing `depositDust` mean that the asset has none; otherwise a
  // destination without a minimum leaves the minimum unknown, which blocks.
  isAssetListReady: boolean;
  // The sign-only developer switch as the page saw it when the button was
  // pressed, and a getter for its latest value in later callbacks.
  isSignOnlyEnabled: boolean;
  isSignOnlyEnabledNow: () => boolean;
  // This page instance already saw a successful submit for the session.
  hasSentLocally: boolean;
  intl: IntlShape;
  navigationToTxConfirm: ReturnType<
    typeof useSignatureConfirm
  >['navigationToTxConfirm'];
  onSent: (localId: string) => void;
  setNotice: (notice: IBinanceDepositSendNotice) => void;
  logSendResult: (params: IBinanceDepositSendResultLog) => void;
  refreshState: () => Promise<unknown>;
};

export const BINANCE_DEPOSIT_SIGN_ONLY_TEXT =
  'The developer switch "Always sign only, do not broadcast" is on. A sign-only transaction id is not on chain and the report slot holds a single value, so the transfer is disabled. Turn the switch off under Developer settings > Transaction & Signature.';

const BUILD_FAILED_TEXT =
  'The transaction could not be built, so nothing was signed.';
const SEND_ATTEMPT_UNACKNOWLEDGED_TEXT =
  'An earlier transfer of this session may already have been broadcast. Check the account history first, then confirm on the deposit page that it was not sent.';
const REPEAT_SIGN_BLOCKED_TEXT =
  'An earlier attempt on this page may already have been broadcast. Close this page and check the account history before sending again.';
const SENDER_ACCOUNT_UNSUPPORTED_TEXT =
  'The sender is an external or watch-only account. Use an account whose transactions this app signs and broadcasts itself.';
// Not a failure in itself: the reason the confirm page gives when a check
// right before signing stopped it.
const BEFORE_SEND_CHECK_REASON = 'before_send_check';
const REVALIDATE_FAILED_REASON = 'revalidate_failed';
// The service refused the pre-sign check because the session already carries
// a signing attempt or a report that the snapshot used here did not show yet.
const SEND_ATTEMPT_UNRESOLVED_REASON = 'send_attempt_unresolved';
const MEMO_FALLBACK_MAX_LENGTH = 256;
const NUMERIC_MEMO_REGEX = /^[0-9]+$/;

type IDepositTokenResult =
  | { ok: true; detail: IFetchTokenDetailItem }
  | { ok: false; reason: string; text: string };

const TOKEN_UNAVAILABLE: IDepositTokenResult = {
  ok: false,
  reason: 'token_unavailable',
  text: 'The token of this deposit could not be loaded for the sender account.',
};

const TOKEN_MISMATCH: IDepositTokenResult = {
  ok: false,
  reason: 'token_mismatch',
  text: 'The loaded token does not match the asset of this deposit.',
};

const NATIVE_SYMBOL_MISMATCH: IDepositTokenResult = {
  ok: false,
  reason: 'token_mismatch',
  text: 'The native coin of this network is not the asset of this deposit.',
};

const ASSET_BLOCKS: Record<
  IBinanceDepositAssetBlockReason,
  { reason: string; text: string }
> = {
  single_token_network: {
    reason: 'token_unsupported',
    text: 'This network can only send its native coin from the app, so this asset cannot be deposited from here.',
  },
  native_placeholder_contract: {
    reason: 'native_placeholder_contract',
    text: 'Binance lists the native coin of this network under a placeholder contract, which the app cannot send to. This asset cannot be deposited from here.',
  },
};

function isSendAttemptUnresolvedError(error: unknown): boolean {
  return (
    getBinanceDepositErrorCode(error) ===
    EBinanceDepositLocalErrorCode.SendAttemptUnresolved
  );
}

function normalizeSymbol(symbol: string | undefined): string {
  return typeof symbol === 'string' ? symbol.trim().toUpperCase() : '';
}

// Reads the same switch the broadcast path reads, at call time.
async function readSignOnlySwitch(): Promise<boolean> {
  const devSettings =
    await backgroundApiProxy.serviceDevSetting.getDevSetting();
  return Boolean(
    devSettings.enabled && devSettings.settings?.alwaysSignOnlySendTx,
  );
}

async function fetchDepositToken({
  accountId,
  networkId,
  contractAddress,
  cryptoCurrency,
}: {
  accountId: string;
  networkId: string;
  contractAddress?: string;
  cryptoCurrency: string;
}): Promise<IDepositTokenResult> {
  const { serviceToken } = backgroundApiProxy;
  // A contract token that cannot be found is an error; it must never fall
  // back to the native coin.
  const token = contractAddress
    ? await serviceToken.getToken({
        accountId,
        networkId,
        tokenIdOnNetwork: contractAddress,
      })
    : await serviceToken.getNativeToken({ accountId, networkId });
  if (!token) {
    return TOKEN_UNAVAILABLE;
  }
  if (
    contractAddress &&
    (token.isNative ||
      !isSameBinanceDepositAddress({
        networkId,
        a: token.address,
        b: contractAddress,
      }))
  ) {
    return TOKEN_MISMATCH;
  }

  // The token above may come from the local cache, which has no balance and
  // can be stale. The transfer is built from a fresh read, as Send does, and
  // that read has to be the asset of this deposit.
  const isNativeAsset = !contractAddress;
  const details = await serviceToken.fetchTokensDetails({
    accountId,
    networkId,
    contractList: [token.address],
    withFrozenBalance: true,
  });
  const detail = details.find((item) =>
    isNativeAsset
      ? Boolean(item.info.isNative)
      : !item.info.isNative &&
        isSameBinanceDepositAddress({
          networkId,
          a: item.info.address,
          b: token.address,
        }),
  );
  if (!detail) {
    return TOKEN_UNAVAILABLE;
  }
  // "No contract address" is all that makes an asset native up to here. An
  // asset the upstream lists without one, while it is not the coin of this
  // network, would otherwise be sent as that coin, amount for amount.
  if (
    isNativeAsset &&
    normalizeSymbol(detail.info.symbol) !== normalizeSymbol(cryptoCurrency)
  ) {
    return NATIVE_SYMBOL_MISMATCH;
  }
  if (
    tokenRebaseUtils.isScalingBalanceMultiplier(
      tokenRebaseUtils.pickBalanceMultiplier(detail),
    )
  ) {
    // The amount typed on the page is used as the raw transfer amount.
    return {
      ok: false,
      reason: 'token_scaled_unsupported',
      text: 'Tokens with a balance multiplier are not supported by this self-test flow.',
    };
  }
  return { ok: true, detail };
}

// Takes the amount collected on the deposit page straight to the existing
// confirm page; the Send address and amount pages are not involved. Every
// check those pages would have run on a recipient is run here first, and any
// check that does not pass stops the transfer.
//
// Never rejects. Nothing caught here is rendered or logged.
export async function runBinanceDepositSendFlow({
  session,
  amountInput,
  requiresAddressTag,
  depositDust,
  isAssetListReady,
  isSignOnlyEnabled,
  isSignOnlyEnabledNow,
  hasSentLocally,
  intl,
  navigationToTxConfirm,
  onSent,
  setNotice,
  logSendResult,
  refreshState,
}: IBinanceDepositSendFlowParams): Promise<void> {
  const { localId, networkId, accountId, senderAddress, destination } = session;
  const sid = maskBinanceDepositSessionId(session.sessionId ?? localId);

  const block = (reason: string, text: string) => {
    logSendResult({ sid, result: 'blocked', reason });
    setNotice({ type: 'critical', text });
    Toast.error({ title: 'Transfer blocked', message: text });
  };

  try {
    if (
      session.status !== EBinanceDepositSessionStatus.AUTHORIZED ||
      isBinanceDepositSessionClosed(session) ||
      !destination?.address
    ) {
      block(
        'not_authorized',
        'The session is not authorized, so there is no deposit address to send to.',
      );
      return;
    }
    if (session.report || hasSentLocally) {
      block(
        'already_sent',
        'A transaction was already submitted for this session, and the report slot holds a single transaction.',
      );
      return;
    }
    // Signing was allowed to start before and nothing recorded how it ended.
    // The hold is lifted on the deposit page, once the user has checked.
    if (typeof session.sendAttemptedAt === 'number') {
      block('send_attempt_unacknowledged', SEND_ATTEMPT_UNACKNOWLEDGED_TEXT);
      return;
    }
    if (destination.networkId !== networkId) {
      block(
        'destination_mismatch',
        'The deposit address belongs to another network than this session.',
      );
      return;
    }
    // The report slot takes one transaction id and trusts it. An external
    // account (WalletConnect and the like) has another wallet send the
    // transaction and only relays the id that wallet answers with; a
    // watch-only account cannot sign at all.
    if (
      accountUtils.isExternalAccount({ accountId }) ||
      accountUtils.isWatchingAccount({ accountId })
    ) {
      block('sender_account_unsupported', SENDER_ACCOUNT_UNSUPPORTED_TEXT);
      return;
    }

    // 1. A sign-only transaction is never broadcast.
    if (isSignOnlyEnabled || (await readSignOnlySwitch())) {
      block('sign_only', BINANCE_DEPOSIT_SIGN_ONLY_TEXT);
      return;
    }

    // 2. Amount: the minimum is a hard floor, there is no confirm path. A
    // minimum that is not known blocks just the same.
    const amountCheck = validateBinanceDepositAmount({
      amount: amountInput,
      minAmount: destination.minAmount,
      depositDust,
      isAssetListReady,
    });
    if (!amountCheck.ok) {
      block(
        `amount_${amountCheck.reason}`,
        getBinanceDepositAmountRejectText(amountCheck.reason),
      );
      return;
    }
    const { amount } = amountCheck;

    // 3. The asset has to be one the app can send on this network. That is
    // judged from what the vault can build, before and independently of
    // whatever the token API returns for the listed contract.
    const vaultSettings =
      await backgroundApiProxy.serviceNetwork.getVaultSettings({ networkId });
    const assetBlockReason = getBinanceDepositAssetBlockReason({
      networkId,
      contractAddress: destination.contractAddress,
      isSingleToken: vaultSettings.isSingleToken,
    });
    if (assetBlockReason) {
      const assetBlock = ASSET_BLOCKS[assetBlockReason];
      block(assetBlock.reason, assetBlock.text);
      return;
    }

    // Token, with a fresh balance.
    const tokenResult = await fetchDepositToken({
      accountId,
      networkId,
      contractAddress: destination.contractAddress || undefined,
      cryptoCurrency: destination.cryptoCurrency,
    });
    if (!tokenResult.ok) {
      block(tokenResult.reason, tokenResult.text);
      return;
    }
    const { detail } = tokenResult;
    const tokenInfo: IToken = { ...detail.info, accountId, networkId };
    const balanceCheck = validateBinanceDepositAmount({
      amount,
      minAmount: destination.minAmount,
      depositDust,
      isAssetListReady,
      decimals: tokenInfo.decimals,
      balance: detail.balanceParsed,
      checkBalance: true,
    });
    if (!balanceCheck.ok) {
      block(
        `amount_${balanceCheck.reason}`,
        getBinanceDepositAmountRejectText(balanceCheck.reason),
      );
      return;
    }

    // 4. Tag. The server value is used verbatim, never trimmed or edited.
    const tag = destination.addressTag;
    if (tag) {
      if (!vaultSettings.withMemo) {
        block(
          'tag_unsupported',
          'The deposit address carries a tag, but this network does not support one.',
        );
        return;
      }
      const memoCheck = await backgroundApiProxy.serviceSend.validateMemo({
        networkId,
        accountId,
        memo: tag,
        tokenAddress: tokenInfo.address,
      });
      if (
        (vaultSettings.numericOnlyMemo && !NUMERIC_MEMO_REGEX.test(tag)) ||
        tag.length >
          (vaultSettings.memoMaxLength || MEMO_FALLBACK_MAX_LENGTH) ||
        !memoCheck.isValid
      ) {
        block(
          'tag_invalid',
          'The deposit tag did not pass the memo check of this network.',
        );
        return;
      }
    } else if (requiresAddressTag ?? Boolean(vaultSettings.withMemo)) {
      block(
        'tag_missing',
        'This asset needs a deposit tag, but the session has none.',
      );
      return;
    }

    // 5. The same recipient check the Send amount page runs before it goes
    // to the confirm page, transfer allowlist included.
    const queryResult =
      await backgroundApiProxy.serviceAccountProfile.queryAddress({
        networkId,
        accountId,
        address: destination.address,
        enableAddressBook: true,
        enableAddressContract: true,
        enableVerifySendFundToSelf: true,
        enableWalletName: true,
        enableAllowListValidation:
          !networkUtils.isLightningNetworkByNetworkId(networkId),
        ignoreSimilarAddressInAddressBook: true,
        enableCheckSimilarAddressInAddressBook: true,
        tokenAddress: getBadgeQueryTokenAddress({
          isNFT: false,
          isNative: tokenInfo.isNative,
          tokenAddress: tokenInfo.address,
        }),
      });
    const validStatus = queryResult.validStatus ?? 'unknown';
    if (validStatus !== 'valid') {
      block(
        `address_${validStatus}`,
        getBinanceDepositAddressRejectText(validStatus),
      );
      return;
    }
    // Send replaces the recipient with the locally normalized address. Here
    // the recipient is only ever the server value, so a local form that
    // differs blocks the transfer instead of replacing it.
    if (
      queryResult.validAddress &&
      !isSameBinanceDepositAddress({
        networkId,
        a: queryResult.validAddress,
        b: destination.address,
      })
    ) {
      block(
        'address_form_differs',
        'The deposit address is not in the canonical form of this network.',
      );
      return;
    }
    if (queryResult.similarAddress) {
      try {
        await showSimilarAddressDialog({
          similarAddress: queryResult.similarAddress,
          currentAddress: destination.address,
        });
      } catch {
        logSendResult({
          sid,
          result: 'cancel',
          reason: 'similar_address_declined',
        });
        return;
      }
    }
    const network = await backgroundApiProxy.serviceNetwork.getNetworkSafe({
      networkId,
    });
    const { canProceed } = await confirmCexDepositIfUnsupported({
      intl,
      isNFT: false,
      networkId,
      tokenSymbol: tokenInfo.symbol,
      networkName: network?.name,
      page: 'amount',
      cexSupportedInfo: queryResult.cexSupportedInfo,
    });
    if (!canProceed) {
      logSendResult({ sid, result: 'cancel', reason: 'cex_warning_declined' });
      return;
    }

    // 6. Re-verify before the confirm page opens. On TRON an energy rental
    // can be signed and paid before `onBeforeSend` runs, so a session that
    // already went stale is stopped here.
    try {
      await backgroundApiProxy.serviceBinanceDeposit.revalidateBeforeSign(
        localId,
      );
    } catch (error) {
      // The background call raised its own toast. When it refused because of
      // an earlier attempt, the text points at the account history and the
      // refresh below brings up the hold the snapshot did not show yet.
      logSendResult({
        sid,
        result: 'blocked',
        reason: isSendAttemptUnresolvedError(error)
          ? SEND_ATTEMPT_UNRESOLVED_REASON
          : REVALIDATE_FAILED_REASON,
      });
      setNotice({ type: 'critical', text: getBinanceDepositErrorText(error) });
      void refreshState();
      return;
    }

    // 7. Straight to the confirm page. The memo of the transfer and the memo
    // the confirm page displays come from the same value.
    const memo = tag || undefined;
    const transferInfo: ITransferInfo = {
      from: senderAddress,
      to: destination.address,
      amount,
      tokenInfo,
      memo,
    };
    const transferPayload: ITransferPayload = {
      amountToSend: amount,
      isMaxSend: false,
      isNFT: false,
      originalRecipient: destination.address,
      isToContract: queryResult.isContract ?? false,
      memo,
      tokenInfo,
    };
    let outcome: 'none' | 'success' | 'fail' | 'blocked' = 'none';
    let blockedBeforeSend: { reason: string; text: string } | undefined;
    // Set once signing was allowed to start on this confirm page. A failure
    // after that no longer proves that nothing was broadcast, and on TRON
    // with an energy rental a second confirm builds a transaction with a new
    // id, which the chain would not deduplicate. The page therefore never
    // signs twice; sending again starts over from the deposit page.
    let signMayHaveStarted = false;
    // `onFail` is also how a failed transaction build is reported, and that
    // happens before the confirm page is ever pushed.
    let isConfirmPageOpened = false;

    await navigationToTxConfirm({
      transfersInfo: [transferInfo],
      transferPayload,
      isInternalTransfer: true,
      onBeforeSend: async () => {
        if (signMayHaveStarted) {
          blockedBeforeSend = {
            reason: 'repeat_sign_blocked',
            text: REPEAT_SIGN_BLOCKED_TEXT,
          };
          // The notice is rendered on the deposit page, which this confirm
          // page covers.
          Toast.error({
            title: 'Transfer blocked',
            message: REPEAT_SIGN_BLOCKED_TEXT,
          });
          throw new OneKeyLocalError({
            message:
              'Binance deposit transfer was already attempted on this page.',
            autoToast: false,
          });
        }
        if (await readSignOnlySwitch()) {
          blockedBeforeSend = {
            reason: BEFORE_SEND_CHECK_REASON,
            text: BINANCE_DEPOSIT_SIGN_ONLY_TEXT,
          };
          Toast.error({
            title: 'Transfer blocked',
            message: BINANCE_DEPOSIT_SIGN_ONLY_TEXT,
          });
          throw new OneKeyLocalError({
            message: 'Binance deposit transfer is blocked in sign-only mode.',
            autoToast: false,
          });
        }
        try {
          // The only check that marks the attempt: once it passes, the
          // session records that signing was allowed to start, before the
          // signature exists.
          await backgroundApiProxy.serviceBinanceDeposit.revalidateBeforeSign(
            localId,
            { markSendAttempt: true },
          );
        } catch (error) {
          // Rethrown as is: the confirm page stops before signing, and the
          // background error carries its own toast.
          blockedBeforeSend = {
            reason: isSendAttemptUnresolvedError(error)
              ? SEND_ATTEMPT_UNRESOLVED_REASON
              : BEFORE_SEND_CHECK_REASON,
            text: getBinanceDepositErrorText(error),
          };
          throw error;
        }
        signMayHaveStarted = true;
      },
      onSuccess: (txs: ISendTxOnSuccessData[]) => {
        // The confirm page treats a throwing success callback as a failed
        // send and skips closing itself, so nothing may escape from here.
        try {
          outcome = 'success';
          if (isSignOnlyEnabledNow()) {
            logSendResult({
              sid,
              result: 'blocked',
              reason: 'sign_only_not_reported',
            });
            setNotice({
              type: 'critical',
              text: 'The sign-only switch was on when the confirm page finished, so nothing was reported.',
            });
            return;
          }
          onSent(localId);

          const firstTx = txs.at(0);
          const txid = firstTx?.signedTx.txid;
          if (typeof txid !== 'string' || !txid.trim()) {
            logSendResult({ sid, result: 'success', reason: 'no_txid' });
            setNotice({
              type: 'warning',
              text: 'The transaction was submitted, but no transaction id came back, so nothing was reported.',
            });
            return;
          }
          const txHash = normalizeBinanceDepositTxHash({ networkId, txid });
          const owner = firstTx?.decodedTx.owner;
          logSendResult({
            sid,
            result: 'success',
            txHashPrefix: maskBinanceDepositTxHash(txHash),
          });
          setNotice({
            type: 'info',
            text: 'Transaction submitted. Reporting the transaction hash...',
          });
          void backgroundApiProxy.serviceBinanceDeposit
            .submitReport({
              localId,
              txHash,
              senderAddress:
                typeof owner === 'string' && owner ? owner : senderAddress,
            })
            .then(
              (snapshot) => {
                const reportStatus = snapshot.report?.status;
                if (reportStatus === 'CONFIRMED') {
                  setNotice({
                    type: 'success',
                    text: 'Transaction submitted and reported.',
                  });
                } else if (reportStatus === 'PENDING') {
                  setNotice({
                    type: 'warning',
                    text: 'Transaction submitted. The report is still pending and is retried when the app returns to the foreground, or with "Retry report".',
                  });
                } else {
                  setNotice({
                    type: 'critical',
                    text: 'Transaction submitted, but the report was not accepted. See the Report section.',
                  });
                }
                void refreshState();
              },
              () => {
                setNotice({
                  type: 'warning',
                  text: 'Transaction submitted, but the report call did not complete. See the Report section.',
                });
                void refreshState();
              },
            );
        } catch {
          setNotice({
            type: 'warning',
            text: 'The transaction was submitted, but its result could not be read, so nothing was reported.',
          });
        }
      },
      // Neither callback proves that nothing was broadcast: a failure can be
      // raised after the broadcast, and a closed page can lose the success
      // callback. They only change what the page says.
      onFail: () => {
        if (outcome === 'success') {
          return;
        }
        if (!isConfirmPageOpened) {
          outcome = 'blocked';
          logSendResult({ sid, result: 'blocked', reason: 'build_failed' });
          setNotice({ type: 'critical', text: BUILD_FAILED_TEXT });
          Toast.error({
            title: 'Transfer blocked',
            message: BUILD_FAILED_TEXT,
          });
        } else if (blockedBeforeSend) {
          outcome = 'blocked';
          logSendResult({
            sid,
            result: 'blocked',
            reason: blockedBeforeSend.reason,
          });
          setNotice({ type: 'critical', text: blockedBeforeSend.text });
          blockedBeforeSend = undefined;
        } else {
          outcome = 'fail';
          logSendResult({ sid, result: 'fail' });
          setNotice({
            type: 'warning',
            text: 'The confirm page reported a failure. That does not prove nothing was broadcast: check the account history before sending again.',
          });
          if (signMayHaveStarted) {
            // Shown above the confirm page, where the user decides whether
            // to press confirm again.
            Toast.error({
              title: 'Transfer result unknown',
              message: REPEAT_SIGN_BLOCKED_TEXT,
            });
          }
        }
        void refreshState();
      },
      onCancel: () => {
        if (outcome !== 'none') {
          return;
        }
        logSendResult({ sid, result: 'cancel' });
        setNotice({
          type: 'info',
          text: 'The confirm page was closed. If a submit was already in progress, check the account history before sending again.',
        });
        void refreshState();
      },
    });
    isConfirmPageOpened = true;
  } catch {
    block(
      'preflight_error',
      'The transfer could not be prepared. Check the network and try again.',
    );
  }
}
