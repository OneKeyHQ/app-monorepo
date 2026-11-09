import BigNumber from 'bignumber.js';

import { getNativeListTokenFallback } from '@onekeyhq/kit/src/components/Token/nativeListTokenFallback';
import type { INativeListTokenFallbackTheme } from '@onekeyhq/kit/src/components/Token/nativeListTokenFallback';
import { TOKEN_ROW_CONTAINER_STYLE } from '@onekeyhq/kit/src/components/TokenListView/tokenListRowLayout';
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
import {
  resolvePrivacyChainTargetDisplay,
  toPrivacyChainLocalWalletDisplay,
} from '@onekeyhq/kit/src/utils/privacyChainEndpointLabel';
import type { IPrivacyChainLocalWalletSettings } from '@onekeyhq/kit/src/utils/privacyChainEndpointLabel';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { formatTime } from '@onekeyhq/shared/src/utils/dateUtils';
import { getHistoryTxDisplayStatus } from '@onekeyhq/shared/src/utils/historyUtils';
import { numberFormatAsRenderText } from '@onekeyhq/shared/src/utils/numberUtils';
import {
  collectPrivacyChainOwnAddresses,
  getPrivacyChainPublicDisplayAddress,
} from '@onekeyhq/shared/src/utils/privacyChainDisplayUtils';
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

// Which way an asset transfer went, as the row itself reads it.
export type IHistoryTransferDirection = 'send' | 'receive' | 'both';

export type IHistoryNetworkBadge = {
  logoURI?: string;
  letter?: string;
  textColor?: string;
  backgroundColor?: string;
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
  // Multi-asset summaries contain localized descriptions, not numeric values.
  if (new BigNumber(value).isNaN()) return { text: value };
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

// `letter.size` is the circle the web history renderer draws: 40 for a single
// token, 24 inside a send/receive pair and 20 for a table amount.
function tokenVisual(
  uri?: string,
  isNFT?: boolean,
  letter?: {
    symbol?: string;
    size: number;
    theme?: INativeListTokenFallbackTheme;
  },
): LeadingVisual {
  const fallbackIcon = {
    name: isNFT ? 'ImageSquareWavesOutline' : 'CryptoCoinOutline',
  };
  return {
    kind: 'token',
    ...(uri ? { image: { uri, width: 40, height: 40 } } : {}),
    shape: isNFT ? 'rounded' : 'circle',
    ...(!isNFT && letter?.theme
      ? getNativeListTokenFallback({
          symbol: letter.symbol,
          size: letter.size,
          theme: letter.theme,
          fallbackIcon,
        })
      : { fallbackIcon }),
  };
}

function expandedAmounts({
  sends,
  receives,
  intl,
  currency,
  hideValue,
  tokenFallbackTheme,
}: {
  sends: IDecodedTxTransferInfo[];
  receives: IDecodedTxTransferInfo[];
  intl: IntlShape;
  currency: string;
  hideValue: boolean;
  tokenFallbackTheme?: INativeListTokenFallbackTheme;
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
        leading: tokenVisual(transfer.icon, transfer.isNFT, {
          symbol: transfer.symbol,
          size: 20,
          theme: tokenFallbackTheme,
        }),
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
  localWallet,
  hideValue,
  currency,
  isAllNetworks,
  networkBadge,
  tokenFallbackTheme,
}: {
  history: IAccountHistoryTx;
  intl: IntlShape;
  tableLayout: boolean;
  isUTXO?: boolean;
  localWallet?: IPrivacyChainLocalWalletSettings;
  hideValue: boolean;
  currency: string;
  isAllNetworks?: boolean;
  networkBadge?: IHistoryNetworkBadge;
  // Inverse colors for a token's letter fallback (web lists only).
  tokenFallbackTheme?: INativeListTokenFallbackTheme;
}): {
  row: ActivityRow & {
    amounts: IHistoryAmount[];
    badges: BadgeModel[];
    presentation: 'stacked' | 'table';
  };
  address: string;
  direction?: IHistoryTransferDirection;
  labeledTitle?: boolean;
} {
  const decodedTx = history.decodedTx;
  const action = getDisplayedActions({ decodedTx })[0];
  const status = getHistoryTxDisplayStatus(history);
  const common = { action, decodedTx, intl, isUTXO };
  const label = (id: ETranslations) => intl.formatMessage({ id });
  let title = '';
  let address = '';
  let shieldedTargetLabel = '';
  let leading: LeadingVisual = { kind: 'icon', name: 'Document2Outline' };
  let amounts: IHistoryAmount[] = [];
  let secondaryLeading: LeadingVisual | undefined;
  let direction: IHistoryTransferDirection | undefined;
  // False while the title only restates what the amounts already show
  // (Send, Receive, Swap); true for a backend label or a non-transfer action.
  let labeledTitle = false;
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
    if (!privateSend && localWallet && info.transferTargetIsCount) {
      address = '';
      shieldedTargetLabel = info.transferTarget;
    } else if (!privateSend && localWallet) {
      const target = resolvePrivacyChainTargetDisplay({
        intl,
        localWallet: toPrivacyChainLocalWalletDisplay(localWallet),
        address: info.transferTarget,
        shielded: info.transferTargetShielded,
        side: info.transferTargetSide,
        ownAddresses: collectPrivacyChainOwnAddresses({
          owner: decodedTx.owner,
          transfer: action.assetTransfer,
        }),
      });
      address = target?.address ?? '';
      shieldedTargetLabel = target?.address ? '' : (target?.poolLabel ?? '');
    } else if (localWallet) {
      address = getPrivacyChainPublicDisplayAddress({
        publicAddressPattern: localWallet.publicAddressPattern,
        address,
      });
    }
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
    direction = 'both';
    if (sendOnly) direction = 'send';
    else if (receiveOnly) direction = 'receive';
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
        { symbol: info.sendTokenSymbol, size: 40, theme: tokenFallbackTheme },
      );
    } else if (receiveOnly) {
      title = label(ETranslations.global_receive);
      icon = 'ArrowBottomOutline';
      leading = tokenVisual(
        info.receiveNFTIcon || info.receiveTokenIcon,
        !!info.receiveNFTIcon,
        {
          symbol: info.receiveTokenSymbol,
          size: 40,
          theme: tokenFallbackTheme,
        },
      );
    } else {
      leading = tokenVisual(
        info.sendNFTIcon || info.sendTokenIcon,
        !!(info.sendNFTIcon || info.receiveNFTIcon),
        { symbol: info.sendTokenSymbol, size: 24, theme: tokenFallbackTheme },
      );
      secondaryLeading = tokenVisual(
        info.receiveNFTIcon || info.receiveTokenIcon,
        !!(info.sendNFTIcon || info.receiveNFTIcon),
        {
          symbol: info.receiveTokenSymbol,
          size: 24,
          theme: tokenFallbackTheme,
        },
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
      amounts = expandedAmounts({
        sends,
        receives,
        intl,
        currency,
        hideValue,
        tokenFallbackTheme,
      });
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
    // A local-wallet row's server label describes the wrong side; as in
    // TxActionTransfer, it never overrides Send/Receive.
    if (privateSend) {
      title = label(ETranslations.private_send_private_send);
      labeledTitle = true;
    } else if (
      decodedTx.status !== EDecodedTxStatus.Pending &&
      info.label &&
      !localWallet
    ) {
      title = info.label;
      // The backend labels plain transfers too ("Receive"); only a label
      // that says more than the direction (Claim, Deposit…) counts.
      const plainWords = [
        ETranslations.global_send,
        ETranslations.global_receive,
        ETranslations.global_swap,
      ].map((id) => label(id).toLowerCase());
      labeledTitle = !plainWords.includes(info.label.trim().toLowerCase());
    }
    if (!info.label && decodedTx.actions[0]?.assetTransfer?.isInternalSwap)
      title = label(ETranslations.global_swap);
    else if (
      !info.label &&
      decodedTx.actions[0]?.assetTransfer?.isInternalStaking
    ) {
      title = decodedTx.actions[0].assetTransfer.internalStakingLabel ?? '';
      labeledTitle = true;
    }
  } else if (action.type === EDecodedTxActionType.TOKEN_APPROVE) {
    labeledTitle = true;
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
    // Table rows draw the approval token as a 20px amount icon.
    leading = tokenVisual(info.approveIcon, false, {
      symbol: info.approveSymbol,
      size: tableLayout ? 20 : 40,
      theme: tokenFallbackTheme,
    });
    icon = revoke ? 'ShieldCheckDoneOutline' : 'UnlockedOutline';
    let value: Pick<IHistoryAmount, 'text' | 'textSegments'>;
    if (unlimited) {
      const unlimitedText = label(
        ETranslations.swap_page_provider_approve_amount_un_limit,
      );
      if (tableLayout) {
        value = { text: `${unlimitedText} ${info.approveSymbol}`.trimEnd() };
      } else if (hideValue) {
        value = { text: `**** ${info.approveSymbol}`.trimEnd() };
      } else {
        value = { text: unlimitedText };
      }
    } else {
      value = formatHistoryNumber(info.approveAmount, {
        balance: true,
        symbol: info.approveSymbol,
        hideValue,
      });
    }
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
    labeledTitle = true;
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
  const badgeLogoURI = decodedTx.networkLogoURI || networkBadge?.logoURI;
  const withNetworkBadge = (visual: LeadingVisual): LeadingVisual => {
    if (!isAllNetworks || visual.kind !== 'token') return visual;
    if (badgeLogoURI)
      return {
        ...visual,
        networkImage: { uri: badgeLogoURI, width: 16, height: 16 },
      };
    if (networkBadge?.letter)
      return {
        ...visual,
        // NativeList cannot mount NetworkAvatar; its text overlay preserves
        // the initial used for custom networks without a logo.
        overlays: [
          ...(visual.overlays ?? []),
          {
            position: 'bottomRight',
            size: 16,
            text: networkBadge.letter,
            tintColor: networkBadge.textColor,
            backgroundColor: networkBadge.backgroundColor,
          },
        ],
      };
    return visual;
  };
  leading = withNetworkBadge(leading);
  if (secondaryLeading) secondaryLeading = withNetworkBadge(secondaryLeading);
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
  if (status === EDecodedTxStatus.Failed || status === EDecodedTxStatus.Dropped)
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
  const shortAddress =
    accountUtils.shortenAddress({ address }) || shieldedTargetLabel;
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
    direction,
    labeledTitle,
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
        container: TOKEN_ROW_CONTAINER_STYLE,
        horizontalPadding: 12,
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
