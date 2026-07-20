import BigNumber from 'bignumber.js';

import { computeNonZeroIds } from '@onekeyhq/kit-bg/src/states/jotai/contexts/tokenList/cellsPure/pure';
import type { IHomeContainerSection } from '@onekeyhq/native-components';
import type { ETranslations } from '@onekeyhq/shared/src/locale';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import defiUtils from '@onekeyhq/shared/src/utils/defiUtils';
import { buildAddressMapInfoKey } from '@onekeyhq/shared/src/utils/historyUtils';
import type { IPerpsHomeView } from '@onekeyhq/shared/src/utils/perpsHomeViewUtils';
import { getHyperliquidTokenImageUrl } from '@onekeyhq/shared/src/utils/perpsUtils';
import { sortTokensByFiatValue } from '@onekeyhq/shared/src/utils/tokenUtils';
import { getDisplayedActions } from '@onekeyhq/shared/src/utils/txActionUtils';
import type { IAddressBadge } from '@onekeyhq/shared/types/address';
import type {
  IDeFiProtocol,
  IDeFiSupportedProtocolAction,
  IProtocolSummary,
} from '@onekeyhq/shared/types/defi';
import type { IAccountHistoryTx } from '@onekeyhq/shared/types/history';
import { EOnChainHistoryTxType } from '@onekeyhq/shared/types/history';
import type { IAccountNFT } from '@onekeyhq/shared/types/nft';
import type {
  IAccountToken,
  ICustomTokenItem,
  IHomeDefaultToken,
  ITokenFiat,
} from '@onekeyhq/shared/types/token';
import {
  EApproveType,
  EDecodedTxActionType,
  EDecodedTxDirection,
  EDecodedTxStatus,
  type IDecodedTxActionAssetTransfer,
} from '@onekeyhq/shared/types/tx';

import { getProtocolActionBadgeLabelIds } from '../../utils/defiPositionUtils';

const HYPER_EVM_LOGO_URI =
  'https://uni.onekey-asset.com/static/chain/hyper-evm.png';

export const NATIVE_HOME_ACTION_IDS = {
  manageTokens: 'home.portfolio.manageTokens',
  openAsset: 'home.asset.open',
  openDeFiPosition: 'home.defi.position.open',
  openDeFiProtocol: 'home.defi.protocol.open',
  openDeFiOverview: 'home.defi.overview.open',
  toggleDeFiExpanded: 'home.defi.expanded.toggle',
  togglePortfolioDeFiExpanded: 'home.portfolio.defi.expanded.toggle',
  togglePortfolioAssetsExpanded: 'home.portfolio.assets.expanded.toggle',
  openHistory: 'home.history.open',
  loadMoreHistory: 'home.history.loadMore',
  openNFT: 'home.nft.open',
  openPerps: 'home.perps.open',
  openPerpsMarket: 'home.perps.market.open',
  openPerpsHolding: 'home.perps.holding.open',
  openPerpsPosition: 'home.perps.position.open',
  openRiskAssets: 'home.portfolio.riskAssets',
  openSmallBalanceAssets: 'home.portfolio.smallBalance',
} as const;

export interface INativeHomeValueFormatters {
  formatBalance: (value: string) => string;
  formatFiat: (
    value: string | number | undefined,
    sourceCurrency?: string,
  ) => string;
  formatPrice?: (
    value: string | number | undefined,
    sourceCurrency?: string,
  ) => string;
  positiveValueColor?: string;
}

interface INativeHomeListStateLabels {
  empty: string;
  loading: string;
}

export function resolveNativeHomeListStateSlot<T>(
  sections: IHomeContainerSection[],
  createContent: () => T,
): { content: T | undefined; height: number | undefined } {
  for (const section of sections) {
    const stateItem = section.items.find(
      (item) => item.renderer === 'empty' || item.renderer === 'loading',
    );
    if (stateItem?.displayHeight !== undefined) {
      return {
        content: createContent(),
        height: stateItem.displayHeight,
      };
    }
  }
  return { content: undefined, height: undefined };
}

export function resolveNativeHomeCompatibilitySections({
  compatibilitySections,
  sections,
}: {
  compatibilitySections?: IHomeContainerSection[];
  sections: IHomeContainerSection[];
}): IHomeContainerSection[] {
  return compatibilitySections ?? sections;
}

function getPerpsPnlColor(
  pnlUsd: number | undefined,
  colors?: { negative: string; positive: string },
): string | undefined {
  if (pnlUsd === undefined) return undefined;
  return pnlUsd < 0 ? colors?.negative : colors?.positive;
}

function buildStateSection({
  id,
  initialized,
  itemCount,
  labels,
  displayHeight,
}: {
  id: string;
  initialized: boolean;
  itemCount: number;
  labels: INativeHomeListStateLabels;
  displayHeight: number;
}): IHomeContainerSection[] | undefined {
  if (itemCount > 0) {
    return undefined;
  }
  return [
    {
      id,
      items: [
        {
          id: `${id}:state`,
          renderer: initialized ? 'empty' : 'loading',
          title: initialized ? labels.empty : labels.loading,
          displayHeight,
        },
      ],
    },
  ];
}

export function buildNativePortfolioSections({
  tokens,
  tokenMap,
  initialized,
  hideZeroBalanceTokens = false,
  homeDefaultTokenMap,
  customTokens,
  sectionTitle,
  stateLabels,
  formatters,
  networkImageById,
  limit = 6,
  expanded = false,
  footer,
}: {
  tokens: IAccountToken[];
  tokenMap: Record<string, ITokenFiat>;
  initialized: boolean;
  hideZeroBalanceTokens?: boolean;
  homeDefaultTokenMap?: Record<string, IHomeDefaultToken>;
  customTokens?: ICustomTokenItem[];
  sectionTitle?: string;
  stateLabels: INativeHomeListStateLabels;
  formatters: INativeHomeValueFormatters;
  networkImageById?: Record<string, string>;
  limit?: number;
  expanded?: boolean;
  footer?: {
    addTokenEnabled: boolean;
    labels: {
      addToken: string;
      addTokenInstruction: string;
      lowValueAssets: string;
      riskAssets: string;
      showLess: string;
      showMore: string;
    };
    lowValueAssetsCount: number;
    lowValueAssetsValue: string;
    riskAssetsCount: number;
  };
}): IHomeContainerSection[] {
  const tokenById = new Map(tokens.map((token) => [token.$key, token]));
  const visibleTokenIds = hideZeroBalanceTokens
    ? new Set(
        computeNonZeroIds({
          ids: tokens.map((token) => token.$key),
          getFiat: (key) => tokenMap[key],
          getMeta: (key) => tokenById.get(key),
          keepDefault: true,
          homeDefaultTokenMap,
          customTokens,
        }),
      )
    : undefined;
  const filteredTokens = sortTokensByFiatValue({
    tokens: visibleTokenIds
      ? tokens.filter((token) => visibleTokenIds.has(token.$key))
      : tokens,
    map: tokenMap,
  });
  const hasOverflow = filteredTokens.length > limit;
  const visibleTokens = expanded
    ? filteredTokens
    : filteredTokens.slice(0, limit);
  const stateSection = buildStateSection({
    id: 'portfolio-state',
    initialized,
    itemCount: visibleTokens.length,
    labels: stateLabels,
    displayHeight: 320,
  });
  if (stateSection) {
    return stateSection;
  }

  const sections: IHomeContainerSection[] = [
    {
      id: 'portfolio-assets',
      ...(sectionTitle ? { title: sectionTitle } : {}),
      items: visibleTokens.map((token) => {
        const fiat = tokenMap[token.$key];
        const balance = fiat?.balanceParsed || fiat?.balance || '0';
        const parsedPriceChange = Number(fiat?.price24h);
        const priceChange = Number.isFinite(parsedPriceChange)
          ? parsedPriceChange
          : undefined;
        const formattedPriceChange =
          typeof priceChange === 'number'
            ? `${priceChange > 0 ? '+' : ''}${priceChange.toFixed(2)}%`
            : undefined;
        let subtitleDetailColor: string | undefined;
        if (typeof priceChange === 'number' && priceChange !== 0) {
          subtitleDetailColor = priceChange > 0 ? '#1F9D67' : '#D64545';
        }
        return {
          id: token.$key,
          renderer: 'asset' as const,
          title: token.symbol || token.name,
          subtitle: (formatters.formatPrice ?? formatters.formatFiat)(
            fiat?.price,
            fiat?.currency,
          ),
          subtitleDetail: formattedPriceChange,
          subtitleDetailColor,
          value: formatters.formatBalance(balance),
          detail: formatters.formatFiat(fiat?.fiatValue, fiat?.currency),
          imageUrl: token.logoURI,
          titleAccessoryIcon:
            token.isNative && !networkImageById ? ('gas' as const) : undefined,
          badgeImageUrl: token.networkId
            ? networkImageById?.[token.networkId]
            : undefined,
          actionId: NATIVE_HOME_ACTION_IDS.openAsset,
        };
      }),
    },
  ];

  if (!footer) {
    return sections;
  }

  if (hasOverflow && !expanded) {
    sections.push({
      id: 'portfolio-show-more',
      items: [
        {
          id: 'portfolio-show-more',
          renderer: 'showMore',
          title: footer.labels.showMore,
          actionId: NATIVE_HOME_ACTION_IDS.togglePortfolioAssetsExpanded,
        },
      ],
    });
    return sections;
  }

  const footerItems: IHomeContainerSection['items'] = [];
  if (footer.lowValueAssetsCount > 0) {
    footerItems.push({
      id: 'portfolio-low-value-assets',
      renderer: 'asset',
      title: `${footer.lowValueAssetsCount} ${footer.labels.lowValueAssets}`,
      value: footer.lowValueAssetsValue,
      leadingIcon: 'lowValue',
      actionId: NATIVE_HOME_ACTION_IDS.openSmallBalanceAssets,
    });
  }
  if (footer.riskAssetsCount > 0) {
    footerItems.push({
      id: 'portfolio-risk-assets',
      renderer: 'asset',
      title: footer.labels.riskAssets,
      leadingIcon: 'risk',
      actionId: NATIVE_HOME_ACTION_IDS.openRiskAssets,
    });
  }
  if (visibleTokens.length > 0 && footer.addTokenEnabled) {
    footerItems.push({
      id: 'portfolio-add-token',
      renderer: 'addToken',
      title: footer.labels.addTokenInstruction,
      buttonTitle: footer.labels.addToken,
      showChevron: true,
      actionId: NATIVE_HOME_ACTION_IDS.manageTokens,
    });
  }
  if (footerItems.length > 0) {
    sections.push({ id: 'portfolio-footer', items: footerItems });
  }
  if (hasOverflow) {
    sections.push({
      id: 'portfolio-show-less',
      items: [
        {
          id: 'portfolio-show-less',
          renderer: 'showMore',
          title: footer.labels.showLess,
          actionId: NATIVE_HOME_ACTION_IDS.togglePortfolioAssetsExpanded,
        },
      ],
    });
  }

  return sections;
}

export function buildNativePerpsSections({
  view,
  initialized,
  labels,
  stateLabels,
  formatters,
  colors,
}: {
  view: IPerpsHomeView | undefined;
  initialized: boolean;
  labels: {
    long: string;
    margin: string;
    pnl: string;
    positions: string;
    short: string;
  };
  stateLabels: INativeHomeListStateLabels;
  formatters: INativeHomeValueFormatters;
  colors?: {
    negative: string;
    positive: string;
  };
}): IHomeContainerSection[] {
  const itemCount = view ? view.holdings.length + view.positions.length : 0;
  const stateSection = buildStateSection({
    id: 'perps-state',
    initialized,
    itemCount,
    labels: stateLabels,
    displayHeight: initialized ? 560 : 440,
  });
  if (stateSection || !view) {
    return stateSection ?? [];
  }

  const sections: IHomeContainerSection[] = [];

  if (view.holdings.length > 0) {
    sections.push({
      id: 'perps-holdings',
      items: view.holdings.map((holding, index) => ({
        id: `holding:${holding.symbol}:${index}`,
        renderer: 'perps',
        title: holding.displaySymbol,
        imageUrl: getHyperliquidTokenImageUrl(holding.symbol),
        badgeImageUrl: HYPER_EVM_LOGO_URI,
        subtitle: formatters.formatBalance(holding.balance),
        value: formatters.formatFiat(holding.valueUsd, 'usd'),
        detail:
          holding.pnlUsd === undefined
            ? '--'
            : `${holding.pnlUsd < 0 ? '-' : '+'}${formatters.formatFiat(
                Math.abs(holding.pnlUsd),
                'usd',
              )}`,
        accentColor: getPerpsPnlColor(holding.pnlUsd, colors),
        actionId: NATIVE_HOME_ACTION_IDS.openPerpsHolding,
      })),
    });
  }

  if (view.positions.length > 0) {
    sections.push({
      id: 'perps-positions',
      title: labels.positions,
      items: view.positions.map((position, index) => ({
        id: `position:${position.coin}:${index}`,
        renderer: 'perps',
        title: position.coin,
        imageUrl: getHyperliquidTokenImageUrl(position.coin),
        subtitle: `${labels.margin}: ${formatters.formatFiat(
          position.marginUsd,
          'usd',
        )}`,
        value: `${formatters.formatBalance(position.sizeCoin)} ${
          position.coin
        }`,
        detail: formatters.formatFiat(position.pnlUsd, 'usd'),
        badge: `${position.side === 'long' ? labels.long : labels.short} ${
          position.leverageValue
        }x`,
        actionId: NATIVE_HOME_ACTION_IDS.openPerpsPosition,
      })),
    });
  }

  return sections;
}

export function buildNativeDeFiSections({
  protocols,
  protocolMap,
  supportedActions = [],
  initialized,
  stateLabels,
  formatters,
  formatActionLabel,
  sectionTitle,
  labels,
  expanded = false,
  toggleActionId = NATIVE_HOME_ACTION_IDS.openDeFiOverview,
}: {
  protocols: IDeFiProtocol[];
  protocolMap: Record<string, IProtocolSummary>;
  supportedActions?: IDeFiSupportedProtocolAction[];
  initialized: boolean;
  stateLabels: INativeHomeListStateLabels;
  formatters: INativeHomeValueFormatters;
  formatActionLabel?: (labelId: ETranslations) => string;
  sectionTitle?: string;
  labels: {
    positions: string;
    showMore: string;
    showLess?: string;
  };
  expanded?: boolean;
  toggleActionId?: string;
}): IHomeContainerSection[] {
  const stateSection = buildStateSection({
    id: 'defi-state',
    initialized,
    itemCount: protocols.length,
    labels: stateLabels,
    displayHeight: 320,
  });
  if (stateSection) {
    return stateSection;
  }

  return [
    {
      id: 'defi-protocols',
      ...(sectionTitle ? { title: sectionTitle } : {}),
      items: (expanded ? protocols : protocols.slice(0, 6)).map((protocol) => {
        const protocolKey = defiUtils.buildProtocolMapKey({
          networkId: protocol.networkId,
          protocol: protocol.protocol,
        });
        const info = protocolMap[protocolKey];
        const badges = formatActionLabel
          ? getProtocolActionBadgeLabelIds({
              protocol,
              supportedActions,
            }).map(formatActionLabel)
          : [];
        return {
          id: `protocol:${protocolKey}`,
          renderer: 'defi' as const,
          title: info?.protocolName || protocol.protocol,
          subtitle: `${protocol.positions.length} ${labels.positions}`,
          value: formatters.formatFiat(info?.netWorth),
          badges,
          imageUrl: info?.protocolLogo,
          showChevron: true,
          actionId: NATIVE_HOME_ACTION_IDS.openDeFiProtocol,
        };
      }),
    },
    ...(protocols.length > 6
      ? [
          {
            id: 'defi-show-more',
            items: [
              {
                id: 'defi-show-more',
                renderer: 'showMore' as const,
                title: expanded
                  ? (labels.showLess ?? labels.showMore)
                  : labels.showMore,
                actionId: toggleActionId,
              },
            ],
          },
        ]
      : []),
  ];
}

export function buildNativeNFTSections({
  nfts,
  initialized,
  sectionTitle,
  stateLabels,
  networkImageById,
}: {
  nfts: IAccountNFT[];
  initialized: boolean;
  sectionTitle?: string;
  stateLabels: INativeHomeListStateLabels;
  networkImageById?: Record<string, string>;
}): IHomeContainerSection[] {
  const stateSection = buildStateSection({
    id: 'nft-state',
    initialized,
    itemCount: nfts.length,
    labels: stateLabels,
    displayHeight: initialized ? 320 : 760,
  });
  if (stateSection) {
    return stateSection;
  }

  return [
    {
      id: 'nft-collectibles',
      ...(sectionTitle ? { title: sectionTitle } : {}),
      layout: 'grid',
      items: nfts.map((nft) => ({
        id: `${nft.networkId ?? ''}:${nft.collectionAddress}:${nft.itemId}`,
        renderer: 'nft',
        title: nft.metadata?.name || '-',
        subtitle: nft.collectionName,
        value: nft.amount && nft.amount !== '1' ? `×${nft.amount}` : undefined,
        imageUrl: nft.metadata?.image,
        badgeImageUrl: nft.networkId
          ? networkImageById?.[nft.networkId]
          : undefined,
        actionId: NATIVE_HOME_ACTION_IDS.openNFT,
      })),
    },
  ];
}

function getHistoryStatusLabel(
  status: EDecodedTxStatus,
  labels: IBuildNativeHistorySectionsParams['labels'],
): string | undefined {
  if (status === EDecodedTxStatus.Confirmed) {
    return undefined;
  }
  return labels.status[status];
}

function getHistoryAction(history: IAccountHistoryTx) {
  return getDisplayedActions({ decodedTx: history.decodedTx })[0];
}

function getHistoryAddressLabel({
  address,
  addressMap,
  networkId,
}: {
  address?: string;
  addressMap: Record<string, IAddressBadge>;
  networkId: string;
}): string | undefined {
  if (!address) return undefined;
  return addressMap[buildAddressMapInfoKey({ networkId, address })]?.label;
}

function getHistoryTransferTarget(
  transfer: IDecodedTxActionAssetTransfer,
): string {
  const isZeroAddress = (address?: string) =>
    address?.toLowerCase() === '0x0000000000000000000000000000000000000000';
  if (transfer.sends.length > 0 && transfer.receives.length === 0) {
    const targets = Array.from(
      new Set(
        transfer.sends
          .map((item) => item.to)
          .filter((address) => address && !isZeroAddress(address)),
      ),
    );
    return targets.length === 1 ? targets[0] : transfer.to;
  }
  if (transfer.sends.length === 0 && transfer.receives.length > 0) {
    const targets = Array.from(
      new Set(
        transfer.receives
          .map((item) => item.from)
          .filter((address) => address && !isZeroAddress(address)),
      ),
    );
    return targets.length === 1 ? targets[0] : transfer.to || transfer.from;
  }
  return transfer.to;
}

function getHistoryTransferDisplay(
  history: IAccountHistoryTx,
  formatters: INativeHomeValueFormatters,
  labels: IBuildNativeHistorySectionsParams['labels'],
  formatTimestamp: (timestamp: number) => string,
  isAllNetworks: boolean,
  addressMap: Record<string, IAddressBadge>,
): {
  accentColor?: string;
  badgeImageUrl?: string;
  detail?: string;
  imageUrl?: string;
  secondaryImageUrl?: string;
  subtitle?: string;
  title: string;
  value?: string;
} {
  const action = getHistoryAction(history);
  const timestamp =
    history.decodedTx.updatedAt ?? history.decodedTx.createdAt ?? 0;
  const networkLogoURI = history.decodedTx.networkLogoURI;
  const networkId = history.decodedTx.networkId;
  const buildBadgeImageUrl = (imageUrl?: string) =>
    isAllNetworks && networkLogoURI && networkLogoURI !== imageUrl
      ? networkLogoURI
      : undefined;

  if (action?.type === EDecodedTxActionType.TOKEN_APPROVE) {
    const approve = action.tokenApprove;
    const approveAmount = new BigNumber(approve?.amount ?? '');
    const isIncrease =
      approve?.approveType === EApproveType.IncreaseAllowance ||
      approve?.approveType === EApproveType.IncreaseApproval;
    const isRevoke =
      !isIncrease && approveAmount.isFinite() && approveAmount.eq(0);
    const title =
      approve?.label ||
      (isRevoke ? labels.revokeApprove(approve?.symbol ?? '') : labels.approve);
    const subtitle =
      getHistoryAddressLabel({
        address: approve?.spender,
        addressMap,
        networkId,
      }) ||
      history.decodedTx.interactInfo?.name ||
      accountUtils.shortenAddress({ address: approve?.spender ?? '' }) ||
      formatTimestamp(timestamp);
    let detail: string | undefined;
    if (approve?.isInfiniteAmount) {
      detail = labels.unlimited;
    } else if (approve?.amount && approve.symbol) {
      detail = `${formatters.formatBalance(approve.amount)} ${approve.symbol}`;
    }
    return {
      title,
      subtitle,
      imageUrl: approve?.icon || networkLogoURI,
      badgeImageUrl: buildBadgeImageUrl(approve?.icon),
      value: approve?.name || approve?.symbol,
      detail,
    };
  }

  if (action?.type === EDecodedTxActionType.FUNCTION_CALL) {
    const functionCall = action.functionCall;
    const imageUrl = functionCall?.icon || networkLogoURI;
    return {
      title: functionCall?.functionName || labels.contract,
      subtitle:
        getHistoryAddressLabel({
          address: functionCall?.to,
          addressMap,
          networkId,
        }) ||
        history.decodedTx.interactInfo?.name ||
        accountUtils.shortenAddress({ address: functionCall?.to ?? '' }) ||
        formatTimestamp(timestamp),
      imageUrl,
      badgeImageUrl: buildBadgeImageUrl(imageUrl),
    };
  }

  const transfer = action?.assetTransfer;
  if (!transfer) {
    const imageUrl = action?.unknownAction?.icon || networkLogoURI;
    return {
      title: action?.unknownAction?.label || labels.contract,
      subtitle:
        getHistoryAddressLabel({
          address: action?.unknownAction?.to,
          addressMap,
          networkId,
        }) ||
        history.decodedTx.interactInfo?.name ||
        accountUtils.shortenAddress({
          address: action?.unknownAction?.to ?? '',
        }) ||
        formatTimestamp(timestamp),
      imageUrl,
      badgeImageUrl: buildBadgeImageUrl(imageUrl),
    };
  }

  const send = transfer.sends[0];
  const receive = transfer.receives[0];
  const hasSend = Boolean(send);
  const hasReceive = Boolean(receive);
  const isOutgoing =
    history.decodedTx.payload?.type === EOnChainHistoryTxType.Send ||
    action.direction === EDecodedTxDirection.OUT;
  const item = hasSend && !hasReceive ? send : (receive ?? send);
  const secondaryItem = hasSend && hasReceive ? send : undefined;
  const imageUrl = item?.icon || networkLogoURI;
  const transferTarget = getHistoryTransferTarget(transfer);
  let defaultTitle = isOutgoing ? labels.send : labels.receive;
  if (transfer.isInternalSwap) {
    defaultTitle = labels.swap;
  } else if (hasSend && !hasReceive) {
    defaultTitle = labels.send;
  } else if (!hasSend && hasReceive) {
    defaultTitle = labels.receive;
  }
  const title = transfer.label || defaultTitle;
  const subtitle =
    getHistoryAddressLabel({
      address: transferTarget,
      addressMap,
      networkId,
    }) ||
    transfer.application?.name ||
    history.decodedTx.interactInfo?.name ||
    accountUtils.shortenAddress({
      address: transferTarget,
    }) ||
    formatTimestamp(timestamp);
  if (!item) {
    return {
      title,
      subtitle,
      imageUrl,
      badgeImageUrl: buildBadgeImageUrl(imageUrl),
    };
  }

  const sign = item === send ? '-' : '+';
  const fiatValue = item.price
    ? new BigNumber(item.amount).times(item.price).toFixed()
    : undefined;
  let detail: string | undefined;
  if (secondaryItem) {
    detail = `-${formatters.formatBalance(secondaryItem.amount)} ${
      secondaryItem.symbol
    }`;
  } else if (fiatValue) {
    detail = formatters.formatFiat(fiatValue, 'usd');
  }
  return {
    title,
    subtitle,
    imageUrl: secondaryItem?.icon || imageUrl,
    secondaryImageUrl: secondaryItem ? item?.icon : undefined,
    badgeImageUrl: buildBadgeImageUrl(secondaryItem?.icon || imageUrl),
    value: `${sign}${formatters.formatBalance(item.amount)} ${item.symbol}`,
    detail,
    accentColor: item === send ? undefined : formatters.positiveValueColor,
  };
}

interface IBuildNativeHistorySectionsParams {
  addressMap?: Record<string, IAddressBadge>;
  history: IAccountHistoryTx[];
  initialized: boolean;
  stateLabels: INativeHomeListStateLabels;
  labels: {
    approve: string;
    contract: string;
    receive: string;
    send: string;
    status: Partial<Record<EDecodedTxStatus, string>>;
    swap: string;
    unknown: string;
    unlimited?: string;
    revokeApprove: (symbol: string) => string;
  };
  formatBalance: INativeHomeValueFormatters['formatBalance'];
  formatFiat?: INativeHomeValueFormatters['formatFiat'];
  formatSectionDate: (timestamp: number) => string;
  formatTimestamp: (timestamp: number) => string;
  isAllNetworks?: boolean;
  loadMoreActionId?: string;
  positiveValueColor?: string;
}

export function buildNativeHistorySections({
  addressMap = {},
  history,
  initialized,
  stateLabels,
  labels,
  formatBalance,
  formatFiat = () => '',
  formatSectionDate,
  formatTimestamp,
  isAllNetworks = false,
  loadMoreActionId,
  positiveValueColor,
}: IBuildNativeHistorySectionsParams): IHomeContainerSection[] {
  const stateSection = buildStateSection({
    id: 'history-state',
    initialized,
    itemCount: history.length,
    labels: stateLabels,
    displayHeight: 320,
  });
  if (stateSection) {
    return stateSection;
  }

  const groups = new Map<string, IAccountHistoryTx[]>();
  for (const item of history) {
    const timestamp = item.decodedTx.updatedAt ?? item.decodedTx.createdAt ?? 0;
    const sectionTitle = formatSectionDate(timestamp);
    const group = groups.get(sectionTitle) ?? [];
    group.push(item);
    groups.set(sectionTitle, group);
  }

  const groupEntries = Array.from(groups.entries());
  return groupEntries.map(([sectionTitle, items], sectionIndex) => ({
    id: `history:${sectionIndex}:${sectionTitle}`,
    title: sectionTitle,
    ...(loadMoreActionId && sectionIndex === groupEntries.length - 1
      ? { actionId: loadMoreActionId }
      : {}),
    items: items.map((item) => {
      const transfer = getHistoryTransferDisplay(
        item,
        {
          formatBalance,
          formatFiat,
          positiveValueColor,
        },
        labels,
        formatTimestamp,
        isAllNetworks,
        addressMap,
      );
      return {
        id: item.id,
        renderer: 'history',
        title: transfer.title,
        subtitle: transfer.subtitle,
        value: transfer.value,
        detail: transfer.detail,
        imageUrl: transfer.imageUrl,
        secondaryImageUrl: transfer.secondaryImageUrl,
        badgeImageUrl: transfer.badgeImageUrl,
        accentColor: transfer.accentColor,
        badge: getHistoryStatusLabel(
          item.displayStatus ?? item.decodedTx.status,
          labels,
        ),
        actionId: NATIVE_HOME_ACTION_IDS.openHistory,
      };
    }),
  }));
}
