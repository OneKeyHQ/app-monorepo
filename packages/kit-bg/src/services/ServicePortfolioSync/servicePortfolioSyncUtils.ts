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
  portfolio: IPortfolioPayload;
  portfolioJsonBytes: Uint8Array;
  portfolioJsonText: string;
};

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
  const portfolio = buildPortfolioPayload({
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
  const portfolioJsonText = stringUtils.stableStringify(portfolio);
  const portfolioJsonBytes = Buffer.from(portfolioJsonText, 'utf8');
  const mockArchiveBytes = packPortfolioArchive([
    {
      bytes: portfolioJsonBytes,
      name: 'portfolio.json',
    },
  ]);

  return {
    contentHash: buildPortfolioPayloadHash(portfolio),
    mockArchiveBytes,
    portfolio,
    portfolioJsonBytes,
    portfolioJsonText,
  };
}
