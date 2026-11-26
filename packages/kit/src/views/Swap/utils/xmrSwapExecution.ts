import BigNumber from 'bignumber.js';

import type { IEncodedTx } from '@onekeyhq/core/src/types';
import type {
  ILocalWalletAccountBalance,
  ILocalWalletAccountState,
  ILocalWalletSendReadiness,
} from '@onekeyhq/kit-bg/src/vaults/localWallet/types';
import type { ITransferInfo } from '@onekeyhq/kit-bg/src/vaults/types';
import { XMR_DECIMALS } from '@onekeyhq/shared/src/config/xmr';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import { getSwapProviderOrderIdFromContext } from '@onekeyhq/shared/src/utils/swapHistoryUtils';
import {
  isXmrSwapNetwork,
  isXmrSwapProvider,
} from '@onekeyhq/shared/src/utils/swapXmrUtils';
import type {
  IFetchBuildTxResponse,
  IFetchQuoteResult,
} from '@onekeyhq/shared/types/swap/types';

import type { IntlShape } from 'react-intl';

export class XmrSwapPreflightError extends OneKeyLocalError {}

type IXmrSwapTranslationId =
  | 'error_privacy_sync_required_to_swap'
  | 'error_privacy_sync_in_progress'
  | 'error_privacy_sync_paused'
  | 'error_privacy_funds_not_yet_spendable'
  | 'error_swap_provider_requires_memo';

function formatXmrSwapCopy(
  intl: IntlShape,
  id: IXmrSwapTranslationId,
  defaultMessage: string,
  values: Record<string, number | string>,
) {
  // These Jira keys can use the generated catalog after translations are synced.
  return intl.formatMessage(
    { id: id as ETranslations, defaultMessage },
    values,
  );
}

export function readXmrSwapAmountAtomic(amount?: string): string | undefined {
  if (typeof amount !== 'string' || !/^\d+(?:\.\d+)?$/.test(amount)) {
    return undefined;
  }
  const atomic = new BigNumber(amount).shiftedBy(XMR_DECIMALS);
  if (
    !atomic.isInteger() ||
    atomic.lte(0) ||
    atomic.gt('18446744073709551615')
  ) {
    return undefined;
  }
  return atomic.toFixed();
}

export function readXmrSwapTransfer({
  build,
  quote,
  sender,
  intl,
}: {
  build: IFetchBuildTxResponse;
  quote: IFetchQuoteResult;
  sender: string;
  intl: IntlShape;
}): ITransferInfo {
  const { result, changellyOrder } = build;
  const token = result?.fromTokenInfo;
  const provider = quote.info.provider;
  const quoteAtomic = readXmrSwapAmountAtomic(quote.fromAmount);
  const targetNetworkId = quote.toTokenInfo.networkId;
  const normalizeContract = (address: string) =>
    networkUtils.isEvmNetwork({ networkId: targetNetworkId })
      ? address.toLowerCase()
      : address;
  if (
    !isXmrSwapProvider(provider) ||
    result?.info.provider !== provider ||
    !token?.isNative ||
    !isXmrSwapNetwork(token.networkId) ||
    !isXmrSwapNetwork(quote.fromTokenInfo.networkId) ||
    !quote.fromTokenInfo.isNative ||
    token.contractAddress !== quote.fromTokenInfo.contractAddress ||
    result.toTokenInfo.networkId !== targetNetworkId ||
    normalizeContract(result.toTokenInfo.contractAddress) !==
      normalizeContract(quote.toTokenInfo.contractAddress) ||
    result.fee?.otherFeeInfos?.some(
      ({ amount }) => !new BigNumber(amount).isZero(),
    ) ||
    !quoteAtomic ||
    quoteAtomic !== readXmrSwapAmountAtomic(result.fromAmount) ||
    !build.orderId ||
    !changellyOrder?.orderId ||
    changellyOrder.orderId !==
      getSwapProviderOrderIdFromContext(provider, build.ctx) ||
    !changellyOrder.payinAddress ||
    quoteAtomic !== readXmrSwapAmountAtomic(changellyOrder.amountExpectedFrom)
  ) {
    throw new XmrSwapPreflightError(
      intl.formatMessage({ id: ETranslations.privacy_error_build_failed__msg }),
    );
  }
  if (
    changellyOrder.payinExtraId !== undefined &&
    changellyOrder.payinExtraId !== null &&
    changellyOrder.payinExtraId !== ''
  ) {
    throw new XmrSwapPreflightError(
      formatXmrSwapCopy(
        intl,
        'error_swap_provider_requires_memo',
        'This provider requires a memo, which {symbol} can’t include. Choose another provider.',
        { symbol: token.symbol },
      ),
    );
  }
  return {
    from: sender,
    to: changellyOrder.payinAddress,
    amount: changellyOrder.amountExpectedFrom,
    tokenInfo: {
      ...token,
      isNative: true,
      address: token.contractAddress,
      name: token.name ?? token.symbol,
    },
  };
}

export function getXmrSwapOrderDeadline(
  requestedAt: number,
  durationSeconds?: number,
) {
  if (durationSeconds === undefined) return undefined;
  const deadline = requestedAt + durationSeconds * 1000;
  return Number.isFinite(durationSeconds) &&
    Number.isFinite(deadline) &&
    durationSeconds > 0
    ? deadline
    : requestedAt;
}

export function readXmrSwapTotalAtomic(
  encodedTx: IEncodedTx,
  transfer: ITransferInfo,
) {
  if (
    typeof encodedTx !== 'object' ||
    encodedTx === null ||
    !('from' in encodedTx) ||
    encodedTx.from !== transfer.from ||
    !('to' in encodedTx) ||
    encodedTx.to !== transfer.to ||
    !('amountAtomic' in encodedTx) ||
    encodedTx.amountAtomic !== readXmrSwapAmountAtomic(transfer.amount) ||
    typeof encodedTx.amountAtomic !== 'string' ||
    ('isMaxSend' in encodedTx && encodedTx.isMaxSend === true) ||
    !('feeAtomic' in encodedTx) ||
    typeof encodedTx.feeAtomic !== 'string' ||
    !/^\d+$/.test(encodedTx.feeAtomic)
  ) {
    return undefined;
  }
  return new BigNumber(encodedTx.amountAtomic)
    .plus(encodedTx.feeAtomic)
    .toFixed();
}

export function assertXmrSwapSyncReady({
  state,
  readiness,
  intl,
}: {
  state: ILocalWalletAccountState;
  readiness?: ILocalWalletSendReadiness;
  intl: IntlShape;
}) {
  const symbol = 'XMR';
  if (state.privacyDisabled || readiness?.status === 'storageUnsupported') {
    throw new XmrSwapPreflightError(
      intl.formatMessage({ id: ETranslations.global_not_available }),
    );
  }
  if (state.paused || readiness?.status === 'chainPaused') {
    throw new XmrSwapPreflightError(
      formatXmrSwapCopy(
        intl,
        'error_privacy_sync_paused',
        'Sync paused. Resume to swap {symbol}.',
        { symbol },
      ),
    );
  }
  if (!state.enabled && !state.pendingOperation) {
    throw new XmrSwapPreflightError(
      formatXmrSwapCopy(
        intl,
        'error_privacy_sync_required_to_swap',
        'Turn on privacy sync to swap {symbol}.',
        { symbol },
      ),
    );
  }
  if (!readiness?.canSend || state.pendingOperation) {
    throw new XmrSwapPreflightError(
      typeof readiness?.blocksLeft === 'number'
        ? formatXmrSwapCopy(
            intl,
            'error_privacy_sync_in_progress',
            'Syncing, {blocks} blocks left. You can swap once sync finishes.',
            { blocks: readiness.blocksLeft },
          )
        : intl.formatMessage({
            id: ETranslations.privacy_error_still_syncing__msg,
          }),
    );
  }
}

export function assertXmrSwapBalance({
  amountAtomic,
  balance,
  pending,
  intl,
}: {
  amountAtomic: string;
  balance: ILocalWalletAccountBalance | null;
  pending: boolean;
  intl: IntlShape;
}) {
  if (pending) {
    throw new XmrSwapPreflightError(
      intl.formatMessage({ id: ETranslations.privacy_error_pending_send__msg }),
    );
  }
  const spendable = new BigNumber(balance?.spendable ?? NaN);
  if (!spendable.isInteger() || spendable.isNegative()) {
    throw new XmrSwapPreflightError(
      intl.formatMessage({
        id: ETranslations.privacy_balance_unavailable__msg,
      }),
    );
  }
  if (spendable.gte(amountAtomic)) return;
  const locked = new BigNumber(
    balance?.frozen?.find((part) => part.reason === 'confirming')
      ?.amountParsed ?? 0,
  );
  if (locked.isFinite() && locked.gt(0)) {
    throw new XmrSwapPreflightError(
      formatXmrSwapCopy(
        intl,
        'error_privacy_funds_not_yet_spendable',
        '{amount} {symbol} not yet spendable. Received funds and change unlock in about 20 minutes.',
        { amount: locked.toFixed(), symbol: 'XMR' },
      ),
    );
  }
  throw new XmrSwapPreflightError(
    intl.formatMessage(
      { id: ETranslations.send_error_insufficient_balance },
      { token: 'XMR' },
    ),
  );
}
