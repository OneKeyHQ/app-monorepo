import BigNumber from 'bignumber.js';

import type { IHomeContainerSection } from '@onekeyhq/native-components';
import defiUtils from '@onekeyhq/shared/src/utils/defiUtils';
import type { IPerpsHomeView } from '@onekeyhq/shared/src/utils/perpsHomeViewUtils';
import type {
  IDeFiProtocol,
  IProtocolSummary,
} from '@onekeyhq/shared/types/defi';
import type { IAccountHistoryTx } from '@onekeyhq/shared/types/history';
import { EOnChainHistoryTxType } from '@onekeyhq/shared/types/history';
import type { IAccountNFT } from '@onekeyhq/shared/types/nft';
import type { IAccountToken, ITokenFiat } from '@onekeyhq/shared/types/token';
import {
  EDecodedTxActionType,
  EDecodedTxDirection,
  type EDecodedTxStatus,
} from '@onekeyhq/shared/types/tx';

export const NATIVE_HOME_ACTION_IDS = {
  openAsset: 'home.asset.open',
  openDeFiPosition: 'home.defi.position.open',
  openDeFiProtocol: 'home.defi.protocol.open',
  openDeFiOverview: 'home.defi.overview.open',
  openHistory: 'home.history.open',
  openNFT: 'home.nft.open',
  openPerps: 'home.perps.open',
  openPerpsHolding: 'home.perps.holding.open',
  openPerpsPosition: 'home.perps.position.open',
} as const;

export interface INativeHomeValueFormatters {
  formatBalance: (value: string) => string;
  formatFiat: (
    value: string | number | undefined,
    sourceCurrency?: string,
  ) => string;
}

interface INativeHomeListStateLabels {
  empty: string;
  loading: string;
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
          id: `${id}:${initialized ? 'empty' : 'loading'}`,
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
  sectionTitle,
  stateLabels,
  formatters,
  networkImageById,
}: {
  tokens: IAccountToken[];
  tokenMap: Record<string, ITokenFiat>;
  initialized: boolean;
  hideZeroBalanceTokens?: boolean;
  sectionTitle?: string;
  stateLabels: INativeHomeListStateLabels;
  formatters: INativeHomeValueFormatters;
  networkImageById?: Record<string, string>;
}): IHomeContainerSection[] {
  const visibleTokens = tokens
    .filter((token) => {
      if (!hideZeroBalanceTokens) {
        return true;
      }
      const fiat = tokenMap[token.$key];
      return new BigNumber(fiat?.balanceParsed || fiat?.balance || 0).gt(0);
    })
    .slice(0, 6);
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

  return [
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
          subtitle: formatters.formatFiat(fiat?.price, fiat?.currency),
          subtitleDetail: formattedPriceChange,
          subtitleDetailColor,
          value: formatters.formatBalance(balance),
          detail: formatters.formatFiat(fiat?.fiatValue, fiat?.currency),
          imageUrl: token.logoURI,
          badgeImageUrl: token.networkId
            ? networkImageById?.[token.networkId]
            : undefined,
          actionId: NATIVE_HOME_ACTION_IDS.openAsset,
        };
      }),
    },
  ];
}

export function buildNativePerpsSections({
  view,
  initialized,
  labels,
  stateLabels,
  formatters,
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
}): IHomeContainerSection[] {
  const itemCount = view ? view.holdings.length + view.positions.length : 0;
  const stateSection = buildStateSection({
    id: 'perps-state',
    initialized,
    itemCount,
    labels: stateLabels,
    displayHeight: initialized ? 1100 : 440,
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
        subtitle: `${labels.pnl}: ${formatters.formatFiat(
          holding.pnlUsd,
          'usd',
        )}`,
        value: `${formatters.formatBalance(holding.balance)} ${holding.symbol}`,
        detail: formatters.formatFiat(holding.valueUsd, 'usd'),
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
  initialized,
  stateLabels,
  formatters,
  sectionTitle,
  labels,
}: {
  protocols: IDeFiProtocol[];
  protocolMap: Record<string, IProtocolSummary>;
  initialized: boolean;
  stateLabels: INativeHomeListStateLabels;
  formatters: INativeHomeValueFormatters;
  sectionTitle?: string;
  labels: {
    positions: string;
    showMore: string;
  };
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
      items: protocols.slice(0, 6).map((protocol) => {
        const protocolKey = defiUtils.buildProtocolMapKey({
          networkId: protocol.networkId,
          protocol: protocol.protocol,
        });
        const info = protocolMap[protocolKey];
        return {
          id: `protocol:${protocolKey}`,
          renderer: 'defi' as const,
          title: info?.protocolName || protocol.protocol,
          subtitle: `${protocol.positions.length} ${labels.positions}`,
          value: formatters.formatFiat(info?.netWorth),
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
                title: labels.showMore,
                actionId: NATIVE_HOME_ACTION_IDS.openDeFiOverview,
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
  sectionTitle: string;
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
      title: sectionTitle,
      layout: 'grid',
      items: nfts.map((nft) => ({
        id: `${nft.networkId ?? ''}:${nft.collectionAddress}:${nft.itemId}`,
        renderer: 'nft',
        title: nft.metadata?.name || nft.itemId,
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
): string {
  return labels.status[status] ?? status;
}

function getHistoryTitle(
  history: IAccountHistoryTx,
  labels: IBuildNativeHistorySectionsParams['labels'],
): string {
  const action = history.decodedTx.actions.find((item) => !item.hidden);
  if (action?.assetTransfer?.isInternalSwap) {
    return labels.swap;
  }
  if (action?.type === EDecodedTxActionType.TOKEN_APPROVE) {
    return labels.approve;
  }
  if (action?.type === EDecodedTxActionType.FUNCTION_CALL) {
    return action.functionCall?.functionName || labels.contract;
  }
  if (history.decodedTx.payload?.type === EOnChainHistoryTxType.Receive) {
    return labels.receive;
  }
  if (
    history.decodedTx.payload?.type === EOnChainHistoryTxType.Send ||
    action?.direction === EDecodedTxDirection.OUT
  ) {
    return labels.send;
  }
  if (action?.direction === EDecodedTxDirection.IN) {
    return labels.receive;
  }
  return labels.unknown;
}

function getHistoryTransferDisplay(
  history: IAccountHistoryTx,
  formatters: INativeHomeValueFormatters,
  unlimitedLabel: string,
): {
  badgeImageUrl?: string;
  detail?: string;
  imageUrl?: string;
  secondaryImageUrl?: string;
  value?: string;
} {
  const action = history.decodedTx.actions.find((item) => !item.hidden);
  const transfer = action?.assetTransfer;
  if (!transfer) {
    if (action?.tokenApprove) {
      return {
        imageUrl: action.tokenApprove.icon || history.decodedTx.networkLogoURI,
        badgeImageUrl:
          action.tokenApprove.icon && history.decodedTx.networkLogoURI
            ? history.decodedTx.networkLogoURI
            : undefined,
        value: action.tokenApprove.name || action.tokenApprove.symbol,
        detail: action.tokenApprove.isInfiniteAmount
          ? unlimitedLabel
          : `${formatters.formatBalance(action.tokenApprove.amount)} ${
              action.tokenApprove.symbol
            }`,
      };
    }
    return { imageUrl: history.decodedTx.networkLogoURI };
  }
  const isOutgoing =
    history.decodedTx.payload?.type === EOnChainHistoryTxType.Send ||
    action.direction === EDecodedTxDirection.OUT;
  const primaryItems = isOutgoing ? transfer.sends : transfer.receives;
  const item = primaryItems[0] ?? transfer.sends[0] ?? transfer.receives[0];
  if (!item) {
    return { imageUrl: history.decodedTx.networkLogoURI };
  }
  const sign = isOutgoing ? '-' : '+';
  let swapSecondaryItem;
  if (transfer.isInternalSwap) {
    swapSecondaryItem = isOutgoing ? transfer.receives[0] : transfer.sends[0];
  }
  const applicationIcon = transfer.application?.icon;
  const imageUrl =
    applicationIcon || item.icon || history.decodedTx.networkLogoURI;
  const secondaryImageUrl = applicationIcon
    ? item.icon
    : swapSecondaryItem?.icon;
  const fiatValue = item.price
    ? new BigNumber(item.amount).times(item.price).toFixed()
    : undefined;
  let detail: string | undefined;
  if (swapSecondaryItem) {
    detail = `${isOutgoing ? '+' : '-'}${formatters.formatBalance(
      swapSecondaryItem.amount,
    )} ${swapSecondaryItem.symbol}`;
  } else if (fiatValue) {
    detail = formatters.formatFiat(fiatValue, 'usd');
  }
  return {
    imageUrl,
    secondaryImageUrl,
    badgeImageUrl:
      history.decodedTx.networkLogoURI &&
      history.decodedTx.networkLogoURI !== imageUrl
        ? history.decodedTx.networkLogoURI
        : undefined,
    value: `${sign}${formatters.formatBalance(item.amount)} ${item.symbol}`,
    detail,
  };
}

interface IBuildNativeHistorySectionsParams {
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
  };
  formatBalance: INativeHomeValueFormatters['formatBalance'];
  formatFiat?: INativeHomeValueFormatters['formatFiat'];
  formatSectionDate: (timestamp: number) => string;
  formatTimestamp: (timestamp: number) => string;
}

export function buildNativeHistorySections({
  history,
  initialized,
  stateLabels,
  labels,
  formatBalance,
  formatFiat = () => '',
  formatSectionDate,
  formatTimestamp,
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

  return Array.from(groups.entries()).map(
    ([sectionTitle, items], sectionIndex) => ({
      id: `history:${sectionIndex}:${sectionTitle}`,
      title: sectionTitle,
      items: items.map((item) => {
        const timestamp =
          item.decodedTx.updatedAt ?? item.decodedTx.createdAt ?? 0;
        const transfer = getHistoryTransferDisplay(
          item,
          {
            formatBalance,
            formatFiat,
          },
          labels.unlimited ?? '',
        );
        const description =
          item.decodedTx.interactInfo?.name ||
          item.decodedTx.actions.find((action) => !action.hidden)?.assetTransfer
            ?.application?.name ||
          item.decodedTx.payload?.label;
        const title = getHistoryTitle(item, labels);
        const normalizedDescription = description?.trim();
        const subtitle =
          normalizedDescription &&
          normalizedDescription.toLowerCase() !== title.toLowerCase()
            ? normalizedDescription
            : formatTimestamp(timestamp);
        return {
          id: item.id,
          renderer: 'history',
          title,
          subtitle,
          value: transfer.value,
          detail: transfer.detail,
          imageUrl: transfer.imageUrl,
          secondaryImageUrl: transfer.secondaryImageUrl,
          badgeImageUrl: transfer.badgeImageUrl,
          badge: getHistoryStatusLabel(
            item.displayStatus ?? item.decodedTx.status,
            labels,
          ),
          actionId: NATIVE_HOME_ACTION_IDS.openHistory,
        };
      }),
    }),
  );
}
