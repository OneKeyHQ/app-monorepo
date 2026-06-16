import type {
  EAppEventBusNames,
  IAppEventBusPayload,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { packPortfolioArchive } from '@onekeyhq/shared/src/utils/portfolioArchive';
import {
  buildPortfolioPayload,
  buildPortfolioPayloadHash,
} from '@onekeyhq/shared/src/utils/portfolioPayload';
import type { IPortfolioPayload } from '@onekeyhq/shared/src/utils/portfolioPayload';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';
import type { ICurrencyItem } from '@onekeyhq/shared/types/currency';

import type { IDevSettingsPersistAtom } from '../../states/jotai/atoms/devSettings';

export type IPortfolioSyncSettledPayload =
  IAppEventBusPayload[EAppEventBusNames.AllNetworksTokenListSettled];

export type IPortfolioSyncArtifacts = {
  contentHash: string;
  mockArchiveBytes: ArrayBuffer;
  mockPortfolio: IPortfolioPayload;
  mockPortfolioJsonBytes: Uint8Array;
  mockPortfolioJsonText: string;
  portfolio: IPortfolioPayload;
  portfolioJsonBytes: Uint8Array;
  portfolioJsonText: string;
};

export const PORTFOLIO_SYNC_TRANSFER_COOLDOWN_MS = 20_000;

export function getPortfolioSyncCooldownRemainingMs({
  cooldownMs = PORTFOLIO_SYNC_TRANSFER_COOLDOWN_MS,
  lastTransferAt,
  now,
}: {
  cooldownMs?: number;
  lastTransferAt?: number;
  now: number;
}): number {
  if (!lastTransferAt) {
    return 0;
  }
  return Math.max(lastTransferAt + cooldownMs - now, 0);
}

export function isPortfolioSyncDevEnabled({
  devSettings,
  runtimeDevEnabled,
}: {
  devSettings: IDevSettingsPersistAtom;
  runtimeDevEnabled: boolean;
}): boolean {
  if (!devSettings.enabled) {
    return false;
  }
  return devSettings.settings?.enablePortfolioSyncDev ?? runtimeDevEnabled;
}

function buildServerSubmitPortfolio(
  mockPortfolio: IPortfolioPayload,
): IPortfolioPayload {
  return {
    ...mockPortfolio,
    tokens: mockPortfolio.tokens.map((token) => ({
      ...token,
      iconName: null,
    })),
  };
}

export function buildPortfolioSyncArtifacts({
  currencyMap,
  displayCurrency,
  eventPayload,
  timestamp,
}: {
  currencyMap: Record<string, ICurrencyItem>;
  displayCurrency: {
    id: string;
    symbol: string;
  };
  eventPayload: IPortfolioSyncSettledPayload;
  timestamp: number;
}): IPortfolioSyncArtifacts {
  const mockPortfolio = buildPortfolioPayload({
    account: {
      addressMasked: accountUtils.shortenAddress({
        address: eventPayload.accountAddress,
      }),
      label: eventPayload.accountName || eventPayload.accountId || '',
    },
    aggregateTokenMap: eventPayload.aggregateTokenMap,
    currencyMap,
    displayCurrency,
    timestamp,
    tokenMap: eventPayload.tokenMap,
    tokens: eventPayload.tokens,
  });
  const portfolio = buildServerSubmitPortfolio(mockPortfolio);
  const portfolioJsonText = stringUtils.stableStringify(portfolio);
  const portfolioJsonBytes = Buffer.from(portfolioJsonText, 'utf8');
  const mockPortfolioJsonText = stringUtils.stableStringify(mockPortfolio);
  const mockPortfolioJsonBytes = Buffer.from(mockPortfolioJsonText, 'utf8');
  const mockArchiveBytes = packPortfolioArchive([
    {
      bytes: mockPortfolioJsonBytes,
      name: 'portfolio.json',
    },
  ]);

  return {
    contentHash: buildPortfolioPayloadHash(portfolio),
    mockArchiveBytes,
    mockPortfolio,
    mockPortfolioJsonBytes,
    mockPortfolioJsonText,
    portfolio,
    portfolioJsonBytes,
    portfolioJsonText,
  };
}
