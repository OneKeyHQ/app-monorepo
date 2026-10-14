import semver from 'semver';

import type {
  EAppEventBusNames,
  IAppEventBusPayload,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { isProtocolV2ProductType } from '@onekeyhq/shared/src/utils/hardwareDeviceTypes';
import { packPortfolioArchive } from '@onekeyhq/shared/src/utils/portfolioArchive';
import {
  buildPortfolioPayload,
  buildPortfolioPayloadHash,
  selectPortfolioPayloadTokens,
} from '@onekeyhq/shared/src/utils/portfolioPayload';
import type {
  IPortfolioCategoryFiat,
  IPortfolioPayload,
} from '@onekeyhq/shared/src/utils/portfolioPayload';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';
import type { ICurrencyItem } from '@onekeyhq/shared/types/currency';

export type IPortfolioSyncSettledPayload =
  IAppEventBusPayload[EAppEventBusNames.AllNetworksTokenListSettled];

export type IPortfolioServerSubmitPayload = IPortfolioPayload & {
  tokens: Array<
    IPortfolioPayload['tokens'][number] & {
      logoURI: string;
    }
  >;
};

export type IPortfolioSyncArtifacts = {
  contentHash: string;
  mockArchiveBytes: ArrayBuffer;
  mockPortfolio: IPortfolioPayload;
  mockPortfolioJsonBytes: Uint8Array;
  mockPortfolioJsonText: string;
  portfolio: IPortfolioServerSubmitPayload;
  portfolioJsonBytes: Uint8Array;
  portfolioJsonText: string;
};

export const PORTFOLIO_SYNC_TRANSFER_COOLDOWN_MS = 60_000;

export function getPortfolioSchemaVersion(
  firmwareVersion?: string,
  deviceType?: string,
): 1 | 2 {
  // v2 is the Pro 2 / Neo firmware 1.0.2+ contract.
  return isProtocolV2ProductType(deviceType) &&
    firmwareVersion &&
    semver.valid(firmwareVersion) &&
    !semver.prerelease(firmwareVersion) &&
    semver.gte(firmwareVersion, '1.0.2')
    ? 2
    : 1;
}

export function getPortfolioDisplayTimestamp({
  timestamp,
  timezoneOffsetMinutes = new Date(timestamp).getTimezoneOffset(),
}: {
  timestamp: number;
  timezoneOffsetMinutes?: number;
}): number {
  return timestamp - timezoneOffsetMinutes * 60_000;
}

export function getPortfolioSyncCooldownRemainingMs({
  lastAttemptAt,
  cooldownMs = PORTFOLIO_SYNC_TRANSFER_COOLDOWN_MS,
  lastTransferAt,
  now,
}: {
  lastAttemptAt?: number;
  cooldownMs?: number;
  lastTransferAt?: number;
  now: number;
}): number {
  const lastHardwareSyncAt = Math.max(lastAttemptAt ?? 0, lastTransferAt ?? 0);
  if (!lastHardwareSyncAt) {
    return 0;
  }
  return Math.max(lastHardwareSyncAt + cooldownMs - now, 0);
}

function buildPortfolioAccountFromEventPayload(
  eventPayload: IPortfolioSyncSettledPayload,
  schemaVersion: 1 | 2,
): IPortfolioPayload['account'] {
  const accountIdentifier =
    typeof eventPayload.indexedAccountIndex === 'number'
      ? `Account #${eventPayload.indexedAccountIndex + 1}`
      : accountUtils.shortenAddress({
          address: eventPayload.accountAddress,
        });
  const accountName =
    eventPayload.indexedAccountName ||
    eventPayload.accountName ||
    accountIdentifier;

  return {
    addressMasked: accountIdentifier,
    label:
      schemaVersion === 2 &&
      typeof eventPayload.indexedAccountIndex === 'number'
        ? String(eventPayload.indexedAccountIndex + 1)
        : accountName,
  };
}

export function buildPortfolioSyncArtifacts({
  categoryFiat,
  currencyMap,
  displayCurrency,
  eventPayload,
  schemaVersion = 1,
  timestamp,
}: {
  categoryFiat?: IPortfolioCategoryFiat;
  currencyMap: Record<string, ICurrencyItem>;
  displayCurrency: {
    id: string;
    symbol: string;
  };
  eventPayload: IPortfolioSyncSettledPayload;
  schemaVersion?: 1 | 2;
  timestamp: number;
}): IPortfolioSyncArtifacts {
  const portfolioPayloadParams = {
    account: buildPortfolioAccountFromEventPayload(eventPayload, schemaVersion),
    aggregateTokenMap: eventPayload.aggregateTokenMap,
    categoryFiat: categoryFiat ?? eventPayload.homeCategoryFiatUsd,
    currencyMap,
    displayCurrency,
    homeTotalFiatUsd: eventPayload.homeTotalFiatUsd,
    schemaVersion,
    totalFiat: eventPayload.totalFiat,
    totalFiatCurrency: eventPayload.totalFiatCurrency,
    totalTokenCount: eventPayload.totalTokenCount,
    timestamp,
    tokenMap: eventPayload.tokenMap,
    tokens: eventPayload.tokens,
  };
  const selectedSourceTokens = selectPortfolioPayloadTokens(
    portfolioPayloadParams,
  );
  const mockPortfolio = buildPortfolioPayload(portfolioPayloadParams);
  const portfolio: IPortfolioServerSubmitPayload = {
    ...mockPortfolio,
    tokens: mockPortfolio.tokens.map((token, index) => ({
      ...token,
      iconName: null,
      logoURI: selectedSourceTokens[index]?.logoURI ?? '',
    })),
  };
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
