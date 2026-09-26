import BigNumber from 'bignumber.js';

import {
  MAX_DISPLAYED_TRANSFERS,
  formatTransferOverflowLabel,
} from '@onekeyhq/kit/src/components/TxAction/consts';
import { getTxActionTokenApproveInfo } from '@onekeyhq/kit/src/components/TxAction/TxActionTokenApprove';
import {
  buildPrivateSendDisplaySends,
  buildTransferChangeInfo,
  getTxActionTransferInfo,
  groupTransfersByToken,
} from '@onekeyhq/kit/src/components/TxAction/TxActionTransfer';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { formatTime } from '@onekeyhq/shared/src/utils/dateUtils';
import { getHistoryTxDisplayStatus } from '@onekeyhq/shared/src/utils/historyUtils';
import { numberFormatAsRenderText } from '@onekeyhq/shared/src/utils/numberUtils';
import { getDisplayedActions } from '@onekeyhq/shared/src/utils/txActionUtils';
import {
  TX_RISKY_LEVEL_MALICIOUS,
  TX_RISKY_LEVEL_SCAM,
  TX_RISKY_LEVEL_SPAM,
} from '@onekeyhq/shared/src/walletConnect/constant';
import { EOnChainHistoryTxType } from '@onekeyhq/shared/types/history';
import type { IAccountHistoryTx } from '@onekeyhq/shared/types/history';
import { EKytRiskLevel } from '@onekeyhq/shared/types/kyt';
import {
  EApproveType,
  EDecodedTxActionType,
  EDecodedTxStatus,
  EReplaceTxType,
} from '@onekeyhq/shared/types/tx';
import type { IDecodedTxTransferInfo } from '@onekeyhq/shared/types/tx';

import type {
  ActivityRow,
  BadgeModel,
  LeadingVisual,
  ValueTextSegment,
} from '@onekeyfe/react-native-native-list';
import type { IntlShape } from 'react-intl';

export type IHistoryAmount = {
  key: string;
  text: string;
  textSegments?: readonly ValueTextSegment[];
  leading?: LeadingVisual;
  tone?: 'primary' | 'secondary' | 'positive' | 'negative';
  secondaryText?: string;
  secondaryTextSegments?: readonly ValueTextSegment[];
};

export function formatHistoryNumber(
  value: string | undefined,
  options: {
    symbol?: string;
    currency?: string;
    balance?: boolean;
    hideValue?: boolean;
    signs?: boolean;
  },
): Pick<IHistoryAmount, 'text' | 'textSegments'> {
  if (options.hideValue) {
    return {
      text:
        options.balance && options.symbol ? `**** ${options.symbol}` : '****',
    };
  }
  if (!value || value === '-') return { text: '-' };
  const rendered = numberFormatAsRenderText(value, {
    formatter: options.balance ? 'balance' : 'value',
    formatterOptions: {
      tokenSymbol: options.symbol,
      currency: options.currency,
      showPlusMinusSigns: options.signs,
    },
  });
  if (typeof rendered === 'string') return { text: rendered };
  const textSegments = rendered.map<ValueTextSegment>((part) =>
    typeof part === 'string'
      ? { text: part }
      : {
          text: String(part.value),
          ...(part.type === 'sub' ? { style: 'subscript' as const } : {}),
        },
  );
  return { text: textSegments.map((part) => part.text).join(''), textSegments };
}

function tokenVisual(uri?: string, isNFT?: boolean): LeadingVisual {
  return {
    kind: 'token',
    ...(uri ? { image: { uri, width: 40, height: 40 } } : {}),
    shape: isNFT ? 'rounded' : 'circle',
    fallbackIcon: {
      name: isNFT ? 'ImageSquareWavesOutline' : 'CryptoCoinOutline',
    },
  };
}

function expandedAmounts({
  sends,
  receives,
  intl,
  currency,
  hideValue,
}: {
  sends: IDecodedTxTransferInfo[];
  receives: IDecodedTxTransferInfo[];
  intl: IntlShape;
  currency: string;
  hideValue: boolean;
}): IHistoryAmount[] {
  const transfers = [...sends, ...receives];
  const visibleCount =
    transfers.length > MAX_DISPLAYED_TRANSFERS + 1
      ? MAX_DISPLAYED_TRANSFERS
      : transfers.length;
  const result: IHistoryAmount[] = transfers
    .slice(0, visibleCount)
    .map((transfer, index) => {
      const receive = index >= sends.length;
      const fiat =
        transfer.price === undefined || transfer.price === null
          ? undefined
          : new BigNumber(transfer.amount)
              .abs()
              .times(transfer.price)
              .toFixed();
      return {
        key: `${index}:${transfer.tokenIdOnNetwork}`,
        ...formatHistoryNumber(`${receive ? '+' : '-'}${transfer.amount}`, {
          balance: true,
          symbol: transfer.isNFT ? transfer.name : transfer.symbol,
          hideValue,
          signs: true,
        }),
        leading: tokenVisual(transfer.icon, transfer.isNFT),
        tone: receive ? 'positive' : 'primary',
        secondaryText: fiat
          ? formatHistoryNumber(fiat, { currency, hideValue }).text
          : undefined,
        secondaryTextSegments: fiat
          ? formatHistoryNumber(fiat, { currency, hideValue }).textSegments
          : undefined,
      };
    });
  const overflow = transfers.slice(visibleCount);
  if (overflow.length)
    result.push({
      key: 'overflow',
      text: formatTransferOverflowLabel({
        count: overflow.length,
        isNFT: overflow.every((transfer) => transfer.isNFT),
        intl,
      }),
      tone: 'secondary',
      leading: { kind: 'icon', name: 'DotHorOutline' },
    });
  return result;
}

function buildHistoryActivityRowUnchecked({
  history,
  intl,
  tableLayout,
  isUTXO,
  hideValue,
  currency,
  isAllNetworks,
}: {
  history: IAccountHistoryTx;
  intl: IntlShape;
  tableLayout: boolean;
  isUTXO?: boolean;
  hideValue: boolean;
  currency: string;
  isAllNetworks?: boolean;
}): {
  row: ActivityRow & {
    amounts: IHistoryAmount[];
    badges: BadgeModel[];
    presentation: 'stacked' | 'table';
  };
  address: string;
} {
  const decodedTx = history.decodedTx;
  const action = getDisplayedActions({ decodedTx })[0];
  const status = getHistoryTxDisplayStatus(history);
  const common = { action, decodedTx, intl, isUTXO };
  const label = (id: ETranslations) => intl.formatMessage({ id });
  let title = '';
  let address = '';
  let leading: LeadingVisual = { kind: 'icon', name: 'Document2Outline' };
  let amounts: IHistoryAmount[] = [];
  let secondaryLeading: LeadingVisual | undefined;
  let icon = 'Document2Outline';
  const badges: BadgeModel[] = [];
  if (action.type === EDecodedTxActionType.ASSET_TRANSFER) {
    const info = getTxActionTransferInfo(common);
    const privateSend =
      decodedTx.payload?.type === EOnChainHistoryTxType.PrivateSend;
    let sends = privateSend
      ? buildPrivateSendDisplaySends({
          decodedTx,
          sends: info.sends,
          networkLogoURI: decodedTx.networkLogoURI,
        })
      : info.sends;
    let receives = info.receives;
    address = privateSend
      ? (decodedTx.payload?.privateSend?.originalRecipient ?? '')
      : info.transferTarget;
    const bothDirections = sends.length > 0 && receives.length > 0;
    const sendOnly =
      privateSend ||
      (sends.length > 0 && receives.length === 0) ||
      (bothDirections &&
        isUTXO &&
        decodedTx.payload?.type === EOnChainHistoryTxType.Send);
    const receiveOnly =
      !privateSend &&
      ((!sends.length && receives.length > 0) ||
        (bothDirections &&
          isUTXO &&
          decodedTx.payload?.type === EOnChainHistoryTxType.Receive));
    title = info.label;
    if (sendOnly) {
      title = label(
        privateSend
          ? ETranslations.private_send_private_send
          : ETranslations.global_send,
      );
      icon = 'ArrowTopOutline';
      leading = tokenVisual(
        info.sendNFTIcon || info.sendTokenIcon,
        !!info.sendNFTIcon,
      );
    } else if (receiveOnly) {
      title = label(ETranslations.global_receive);
      icon = 'ArrowBottomOutline';
      leading = tokenVisual(
        info.receiveNFTIcon || info.receiveTokenIcon,
        !!info.receiveNFTIcon,
      );
    } else {
      leading = tokenVisual(
        info.sendNFTIcon || info.sendTokenIcon,
        !!(info.sendNFTIcon || info.receiveNFTIcon),
      );
      secondaryLeading = tokenVisual(
        info.receiveNFTIcon || info.receiveTokenIcon,
        !!(info.sendNFTIcon || info.receiveNFTIcon),
      );
    }
    if (tableLayout) {
      if (sendOnly) receives = [];
      if (receiveOnly) sends = [];
      sends = groupTransfersByToken(sends);
      receives = groupTransfersByToken(receives);
      if (
        isUTXO &&
        !privateSend &&
        info.sends.length > 0 &&
        info.receives.length > 0
      ) {
        if (sendOnly && sends.length === 1)
          sends = [
            {
              ...sends[0],
              amount: new BigNumber(decodedTx.nativeAmount ?? 0)
                .abs()
                .toFixed(),
            },
          ];
        if (receiveOnly && receives.length === 1)
          receives = [
            {
              ...receives[0],
              amount: new BigNumber(decodedTx.nativeAmount ?? 0)
                .abs()
                .toFixed(),
            },
          ];
      }
      amounts = expandedAmounts({ sends, receives, intl, currency, hideValue });
    } else {
      const makeChange = (
        transfers: IDecodedTxTransferInfo[],
        receive: boolean,
      ) =>
        buildTransferChangeInfo({
          transfers,
          changePrefix: receive ? '+' : '-',
          intl,
          ...(isUTXO &&
          !privateSend &&
          info.sends.length &&
          info.receives.length
            ? { isUTXO, nativeAmount: decodedTx.nativeAmount }
            : {}),
        });
      const primary = makeChange(sendOnly ? sends : receives, !sendOnly);
      amounts.push({
        key: 'primary',
        ...formatHistoryNumber(primary.change, {
          balance: !!primary.change,
          symbol: primary.changeSymbol,
          signs: true,
          hideValue,
        }),
        tone: primary.change.includes('+') ? 'positive' : 'primary',
      });
      if (sendOnly || receiveOnly) {
        amounts.push({
          key: 'secondary',
          ...formatHistoryNumber(primary.changeDescription, {
            currency,
            hideValue,
          }),
          tone: 'secondary',
        });
      } else {
        const secondary = makeChange(sends, false);
        amounts.push({
          key: 'secondary',
          ...formatHistoryNumber(secondary.change, {
            balance: !!secondary.changeSymbol,
            symbol: secondary.changeSymbol,
            currency: secondary.changeSymbol ? '' : currency,
            signs: !!secondary.changeSymbol,
            hideValue,
          }),
          tone: 'secondary',
        });
      }
    }
    if (!privateSend && decodedTx.actions[0]?.assetTransfer?.isInternalSwap)
      icon = 'SwitchHorOutline';
    else if (
      !privateSend &&
      decodedTx.actions[0]?.assetTransfer?.isInternalStaking
    )
      icon = 'CoinsOutline';
    if (privateSend) title = label(ETranslations.private_send_private_send);
    else if (decodedTx.status !== EDecodedTxStatus.Pending && info.label)
      title = info.label;
    if (!info.label && decodedTx.actions[0]?.assetTransfer?.isInternalSwap)
      title = label(ETranslations.global_swap);
    else if (
      !info.label &&
      decodedTx.actions[0]?.assetTransfer?.isInternalStaking
    )
      title = decodedTx.actions[0].assetTransfer.internalStakingLabel ?? '';
  } else if (action.type === EDecodedTxActionType.TOKEN_APPROVE) {
    const info = getTxActionTokenApproveInfo(common);
    const increase =
      info.approveType === EApproveType.IncreaseAllowance ||
      info.approveType === EApproveType.IncreaseApproval;
    const unlimited =
      info.approveIsMax ||
      (increase && !new BigNumber(info.approveAmount).isFinite());
    const revoke = !increase && new BigNumber(info.approveAmount).eq(0);
    let approvalTitleKey = ETranslations.global_approve;
    if (revoke) approvalTitleKey = ETranslations.global_revoke_approve;
    else if (increase)
      approvalTitleKey = ETranslations.approve_edit_increase_allowance;
    title =
      info.approveLabel ||
      intl.formatMessage(
        {
          id: approvalTitleKey,
        },
        { symbol: info.approveSymbol },
      );
    address = info.approveSpender;
    leading = tokenVisual(info.approveIcon);
    icon = revoke ? 'ShieldCheckDoneOutline' : 'UnlockedOutline';
    const value = formatHistoryNumber(
      unlimited
        ? label(ETranslations.swap_page_provider_approve_amount_un_limit)
        : info.approveAmount,
      {
        balance: true,
        symbol: info.approveSymbol,
        hideValue: tableLayout && unlimited ? false : hideValue,
      },
    );
    if (increase && !unlimited) {
      value.text = `+${value.text}`;
      if (value.textSegments)
        value.textSegments = [{ text: '+' }, ...value.textSegments];
    }
    if (tableLayout) {
      if (!revoke) amounts = [{ key: 'approval', ...value, leading }];
    } else
      amounts = [
        { key: 'name', text: info.approveName },
        { key: 'approval', ...value, tone: 'secondary' },
      ];
  } else {
    const functionCall = action.functionCall;
    const unknown = action.unknownAction;
    title = functionCall
      ? (functionCall.functionName ?? '')
      : unknown?.label ||
        label(ETranslations.transaction__contract_interaction);
    address = functionCall ? (functionCall.to ?? '') : (unknown?.to ?? '');
    leading = {
      kind: 'token',
      image:
        functionCall?.icon || unknown?.icon
          ? {
              uri: functionCall?.icon || unknown?.icon || '',
              width: 40,
              height: 40,
            }
          : undefined,
      fallbackIcon: { name: 'Document2Outline' },
    };
  }
  if (tableLayout) leading = { kind: 'token', fallbackIcon: { name: icon } };
  if (isAllNetworks && decodedTx.networkLogoURI && leading.kind === 'token')
    leading = {
      ...leading,
      networkImage: { uri: decodedTx.networkLogoURI, width: 16, height: 16 },
    };
  if (
    isAllNetworks &&
    decodedTx.networkLogoURI &&
    secondaryLeading?.kind === 'token'
  ) {
    secondaryLeading = {
      ...secondaryLeading,
      networkImage: { uri: decodedTx.networkLogoURI, width: 16, height: 16 },
    };
  }
  if (history.replacedType && status === EDecodedTxStatus.Pending)
    badges.push({
      key: 'replacement',
      text: label(
        history.replacedType === EReplaceTxType.SpeedUp
          ? ETranslations.global_sped_up
          : ETranslations.global_cancelling,
      ),
      tone: 'info',
    });
  if (status === EDecodedTxStatus.Failed)
    badges.push({
      key: 'failed',
      text: label(ETranslations.global_failed),
      tone: 'danger',
    });
  const risk = decodedTx.riskyLevel;
  if (risk === TX_RISKY_LEVEL_SPAM)
    badges.push({
      key: 'risk',
      text: label(ETranslations.global_spam),
      tone: 'neutral',
    });
  if (risk === TX_RISKY_LEVEL_MALICIOUS)
    badges.push({
      key: 'risk',
      text: label(ETranslations.global_malicious),
      tone: 'warning',
    });
  if (risk === TX_RISKY_LEVEL_SCAM)
    badges.push({
      key: 'risk',
      text: label(ETranslations.global_scam),
      tone: 'danger',
    });
  if (
    action.type === EDecodedTxActionType.ASSET_TRANSFER &&
    !accountUtils.isWatchingAccount({ accountId: decodedTx.accountId })
  ) {
    if (decodedTx.kytRiskLevel === EKytRiskLevel.Severe)
      badges.push({
        key: 'kyt',
        text: label(ETranslations.kyt_severe_risk__title),
        tone: 'danger',
      });
    if (decodedTx.kytRiskLevel === EKytRiskLevel.High)
      badges.push({
        key: 'kyt',
        text: label(ETranslations.kyt_high_risk__title),
        tone: 'warning',
      });
  }
  const time = decodedTx.updatedAt ?? decodedTx.createdAt;
  const shortAddress = accountUtils.shortenAddress({ address });
  const description = [
    time && (tableLayout || !shortAddress)
      ? formatTime(new Date(time), {
          hideSeconds: true,
          hideMilliseconds: true,
        })
      : '',
    shortAddress,
  ]
    .filter(Boolean)
    .join(' • ');
  return {
    address,
    row: {
      key: history.id,
      type: 'activity',
      leading,
      secondaryLeading: tableLayout ? undefined : secondaryLeading,
      title,
      description,
      amounts,
      badges,
      presentation: tableLayout ? 'table' : 'stacked',
      opacity:
        risk === TX_RISKY_LEVEL_MALICIOUS || risk === TX_RISKY_LEVEL_SCAM
          ? 0.5
          : 1,
      separator: false,
      style: {
        horizontalPadding: 20,
        verticalPadding: 12,
        lineGap: tableLayout ? 4 : 0,
        title: {
          fontSize: tableLayout ? 14 : 16,
          lineHeight: tableLayout ? 20 : 24,
          fontWeight: 'medium',
          lines: 1,
        },
        description: { fontSize: 14, lineHeight: 20, lines: 1 },
      },
    },
  };
}

// Match the existing per-row error boundary: one malformed transaction must not
// prevent the rest of the history from rendering.
export function buildHistoryActivityRow(
  params: Parameters<typeof buildHistoryActivityRowUnchecked>[0],
): ReturnType<typeof buildHistoryActivityRowUnchecked> {
  try {
    return buildHistoryActivityRowUnchecked(params);
  } catch (error) {
    return {
      address: '',
      row: {
        type: 'activity',
        key: params.history.id,
        leading: { kind: 'icon', name: 'Document2Outline' },
        title: error instanceof Error ? error.message : String(error),
        disabled: true,
        amounts: [],
        badges: [],
        presentation: params.tableLayout ? 'table' : 'stacked',
      },
    };
  }
}
