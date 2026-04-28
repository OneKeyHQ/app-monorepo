import BigNumber from 'bignumber.js';
import { type IntlShape, useIntl } from 'react-intl';

import { SizableText, Stack } from '@onekeyhq/components';
import useFormatDate from '@onekeyhq/kit/src/hooks/useFormatDate';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IPendingTx } from '@onekeyhq/shared/src/types/desktop/tray';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { formatTrayPendingTxAmount } from '@onekeyhq/shared/src/utils/trayDataUtils';
import { getDisplayedActions } from '@onekeyhq/shared/src/utils/txActionUtils';
import {
  EDecodedTxActionType,
  type IDecodedTxAction,
} from '@onekeyhq/shared/types/tx';

const TX_TYPE_TRANSLATION_KEY: Record<string, ETranslations> = {
  send: ETranslations.tray_tx_type_send,
  swap: ETranslations.tray_tx_type_swap,
  contract: ETranslations.tray_tx_type_contract_call,
  approve: ETranslations.tray_tx_type_approve,
};

type ITransferInfo = NonNullable<
  NonNullable<IDecodedTxAction['assetTransfer']>['sends']
>[number];

type IHistoryAlignedDisplayInfo = {
  title: string;
  description?: string;
  primaryValue?: string;
  secondaryValue?: string;
  timestamp?: number;
};

function formatDisplayAmount({
  amount,
  symbol,
  prefix = '',
}: {
  amount?: string;
  symbol?: string;
  prefix?: string;
}) {
  if (!amount || !symbol) return '';
  const bn = new BigNumber(amount);
  const normalizedAmount = bn.isNaN() ? amount : bn.abs().toFixed();
  const formatted = formatTrayPendingTxAmount({
    amountInfo: {
      amount: normalizedAmount,
      symbol,
    },
  });
  return prefix ? `${prefix}${formatted}` : formatted;
}

function formatTransfersAmount({
  transfers,
  prefix,
  intl,
}: {
  transfers: ITransferInfo[];
  prefix: string;
  intl: IntlShape;
}) {
  if (!transfers.length) return '';

  const tokenIds = Array.from(
    new Set(transfers.map((transfer) => transfer.tokenIdOnNetwork)),
  );
  if (tokenIds.length > 1) {
    return intl.formatMessage(
      { id: ETranslations.count_assets },
      { count: tokenIds.length },
    );
  }

  const totalAmount = transfers
    .reduce(
      (acc, transfer) => acc.plus(new BigNumber(transfer.amount).abs()),
      new BigNumber(0),
    )
    .toFixed();
  const firstTransfer = transfers[0];
  return formatDisplayAmount({
    amount: totalAmount,
    symbol: firstTransfer?.isNFT ? firstTransfer?.name : firstTransfer?.symbol,
    prefix,
  });
}

function getSingleTarget({
  transfers,
  key,
  fallback,
}: {
  transfers: ITransferInfo[];
  key: 'from' | 'to';
  fallback?: string;
}) {
  const targets = Array.from(
    new Set(transfers.map((transfer) => transfer[key]).filter(Boolean)),
  );
  return targets.length === 1 ? targets[0] : fallback;
}

function getHistoryAlignedDisplayInfo({
  tx,
  intl,
}: {
  tx: IPendingTx;
  intl: IntlShape;
}): IHistoryAlignedDisplayInfo | undefined {
  const decodedTx = tx.historyTx?.decodedTx;
  if (!decodedTx) return undefined;

  const action = getDisplayedActions({ decodedTx })[0];
  if (!action) return undefined;
  const timestamp = decodedTx.updatedAt ?? decodedTx.createdAt;

  if (action.type === EDecodedTxActionType.TOKEN_APPROVE) {
    const tokenApprove = action.tokenApprove;
    const approveAmount = tokenApprove?.amount ?? '';
    const approveSymbol = tokenApprove?.symbol ?? '';
    const isRevoke = new BigNumber(approveAmount).eq(0);
    const title =
      tokenApprove?.label ||
      (isRevoke
        ? intl.formatMessage(
            { id: ETranslations.global_revoke_approve },
            { symbol: approveSymbol },
          )
        : intl.formatMessage({ id: ETranslations.global_approve }));
    const secondaryValue = tokenApprove?.isInfiniteAmount
      ? `${intl.formatMessage({
          id: ETranslations.swap_page_provider_approve_amount_un_limit,
        })} ${approveSymbol}`
      : formatDisplayAmount({
          amount: approveAmount,
          symbol: approveSymbol,
        });

    return {
      title,
      description: accountUtils.shortenAddress({
        address: tokenApprove?.spender ?? '',
      }),
      primaryValue: tokenApprove?.name || approveSymbol,
      secondaryValue,
      timestamp,
    };
  }

  if (action.type === EDecodedTxActionType.FUNCTION_CALL) {
    const functionCall = action.functionCall;
    return {
      title:
        functionCall?.functionName ||
        intl.formatMessage({
          id: ETranslations.transaction__contract_interaction,
        }),
      description: accountUtils.shortenAddress({
        address: functionCall?.to ?? '',
      }),
      timestamp,
    };
  }

  if (action.type === EDecodedTxActionType.UNKNOWN) {
    const unknownAction = action.unknownAction;
    return {
      title:
        unknownAction?.label ||
        intl.formatMessage({
          id: ETranslations.transaction__contract_interaction,
        }),
      description: accountUtils.shortenAddress({
        address: unknownAction?.to ?? '',
      }),
      timestamp,
    };
  }

  if (action.type === EDecodedTxActionType.ASSET_TRANSFER) {
    const transfer = action.assetTransfer;
    const sends = transfer?.sends ?? [];
    const receives = transfer?.receives ?? [];
    const onlySends = sends.length > 0 && receives.length === 0;
    const onlyReceives = receives.length > 0 && sends.length === 0;
    let title = transfer?.label ?? '';
    let description = transfer?.to ?? decodedTx.to ?? '';
    let primaryValue = '';
    let secondaryValue = '';

    if (onlySends) {
      title =
        transfer?.label ||
        intl.formatMessage({ id: ETranslations.global_send });
      description =
        getSingleTarget({
          transfers: sends,
          key: 'to',
          fallback: transfer?.to,
        }) ?? '';
      primaryValue = formatTransfersAmount({
        transfers: sends,
        prefix: '-',
        intl,
      });
    } else if (onlyReceives) {
      title =
        transfer?.label ||
        intl.formatMessage({ id: ETranslations.global_receive });
      description =
        getSingleTarget({
          transfers: receives,
          key: 'from',
          fallback: transfer?.from,
        }) ?? '';
      primaryValue = formatTransfersAmount({
        transfers: receives,
        prefix: '+',
        intl,
      });
    } else {
      primaryValue = formatTransfersAmount({
        transfers: receives,
        prefix: '+',
        intl,
      });
      secondaryValue = formatTransfersAmount({
        transfers: sends,
        prefix: '-',
        intl,
      });
    }

    if (!transfer?.label && transfer?.isInternalSwap) {
      title = intl.formatMessage({ id: ETranslations.global_swap });
    } else if (!transfer?.label && transfer?.isInternalStaking) {
      title = transfer.internalStakingLabel || title;
    }

    return {
      title,
      description: accountUtils.shortenAddress({ address: description }),
      primaryValue,
      secondaryValue,
      timestamp,
    };
  }

  return undefined;
}

function TxRow({
  tx,
  typeLabel,
  pendingLabel,
  intl,
  formatDate,
  onPress,
}: {
  tx: IPendingTx;
  typeLabel: string;
  pendingLabel: string;
  intl: IntlShape;
  formatDate: (
    date: Date | string,
    options?: { hideTheYear?: boolean },
  ) => string;
  onPress: () => void;
}) {
  const historyInfo = getHistoryAlignedDisplayInfo({ tx, intl });
  const txTime = historyInfo?.timestamp ?? tx.updatedAt ?? tx.createdAt;
  const timeText = txTime
    ? formatDate(new Date(txTime), { hideTheYear: true })
    : '';
  const description =
    historyInfo?.description || accountUtils.shortenAddress({ address: tx.to });
  const primaryValue = historyInfo?.primaryValue || tx.amount;
  const secondaryValue =
    historyInfo?.secondaryValue || tx.confirmations || pendingLabel;

  return (
    <Stack
      flexDirection="row"
      alignItems="center"
      paddingHorizontal="$4"
      paddingVertical="$2.5"
      onPress={onPress}
      cursor="pointer"
      hoverStyle={{ backgroundColor: '$bgHover' }}
    >
      <Stack flex={1}>
        <SizableText fontSize="$bodyMd" color="$text">
          {historyInfo?.title || typeLabel}
        </SizableText>
        {description ? (
          <SizableText fontSize="$bodySm" color="$textSubdued">
            {description}
          </SizableText>
        ) : null}
        {timeText ? (
          <SizableText fontSize="$bodySm" color="$textSubdued">
            {timeText}
          </SizableText>
        ) : null}
      </Stack>
      <Stack alignItems="flex-end">
        {primaryValue ? (
          <SizableText fontSize="$bodyMd" color="$text" textAlign="right">
            {primaryValue}
          </SizableText>
        ) : null}
        {secondaryValue ? (
          <SizableText
            fontSize="$bodySm"
            color="$textSubdued"
            textAlign="right"
          >
            {secondaryValue}
          </SizableText>
        ) : null}
      </Stack>
    </Stack>
  );
}

export function PendingTransactions({
  transactions,
  onTxPress,
  onViewAll,
}: {
  transactions: IPendingTx[];
  onTxPress: (tx: IPendingTx) => void;
  onViewAll: () => void;
}) {
  const intl = useIntl();
  const { formatDate } = useFormatDate();
  const pendingLabel = intl.formatMessage({
    id: ETranslations.tray_pending_status,
  });

  // Failed txs stay in `transactions` for diffAndNotify; don't show them here.
  const visibleTxs = (transactions || []).filter(
    (tx) => tx.status === 'pending',
  );

  if (visibleTxs.length === 0) {
    return (
      <Stack padding="$4">
        <SizableText fontSize="$bodySm" color="$textSubdued" textAlign="center">
          {intl.formatMessage({
            id: ETranslations.tray_no_pending_transactions_desc,
          })}
        </SizableText>
      </Stack>
    );
  }

  const displayTxs = visibleTxs.slice(0, 5);
  const hasMore = visibleTxs.length > 5;

  return (
    <Stack>
      <SizableText
        fontSize="$bodySm"
        color="$textSubdued"
        paddingHorizontal="$4"
        paddingTop="$3"
        paddingBottom="$1"
      >
        {intl.formatMessage({
          id: ETranslations.tray_pending_transactions_title,
        })}
      </SizableText>
      {displayTxs.map((tx) => {
        const keyId = TX_TYPE_TRANSLATION_KEY[tx.type];
        const typeLabel = keyId ? intl.formatMessage({ id: keyId }) : tx.type;
        return (
          <TxRow
            key={tx.id}
            tx={tx}
            typeLabel={typeLabel}
            pendingLabel={pendingLabel}
            intl={intl}
            formatDate={formatDate}
            onPress={() => onTxPress(tx)}
          />
        );
      })}
      {hasMore ? (
        <Stack padding="$3" onPress={onViewAll} cursor="pointer">
          <SizableText
            fontSize="$bodySm"
            color="$textInteractive"
            textAlign="center"
          >
            {intl.formatMessage({ id: ETranslations.tray_view_all })} →
          </SizableText>
        </Stack>
      ) : null}
    </Stack>
  );
}
