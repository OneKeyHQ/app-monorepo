import { useMemo } from 'react';

import BigNumber from 'bignumber.js';

import {
  useAccountDeFiOverviewAtom,
  useAccountWorthAtom,
  useLastConfirmedOverviewBalanceAtom,
  useOverviewDeFiDataStateAtom,
  useWalletTopBannersAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/accountOverview';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { useHomeFactsShadowAtom } from '@onekeyhq/kit/src/states/jotai/contexts/home';
import { useListStructureAtom } from '@onekeyhq/kit/src/states/jotai/contexts/tokenList';
import {
  useCurrencyPersistAtom,
  useSettingsPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { USD_CURRENCY_ID } from '@onekeyhq/shared/src/consts/currencyConsts';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';

import {
  adaptCurrentHomeBalanceFacts,
  buildHomeBalanceQuoteRateIdentity,
  resolveHomeBalanceQuotedAmount,
  selectHomePortfolioWorth,
} from '../facts/currentHomeBalanceFactsAdapter';

import type { IHomeFacts } from '../facts/homeFacts';

function useHomeBalanceFacts(): IHomeFacts | undefined {
  const [shadowFacts] = useHomeFactsShadowAtom();
  const {
    activeAccount: { account, indexedAccount, network, vaultSettings, wallet },
  } = useActiveAccount({ num: 0 });
  const [accountWorth] = useAccountWorthAtom();
  const [accountDeFiOverview] = useAccountDeFiOverviewAtom();
  const [lastConfirmed] = useLastConfirmedOverviewBalanceAtom();
  const [deFiState] = useOverviewDeFiDataStateAtom();
  const [{ banners }] = useWalletTopBannersAtom();
  const [listStructure] = useListStructureAtom();
  const [{ currencyMap }] = useCurrencyPersistAtom();
  const [settings] = useSettingsPersistAtom();

  return useMemo(() => {
    if (
      !shadowFacts ||
      !wallet?.id ||
      !account?.id ||
      !network?.id ||
      shadowFacts.owner.walletId !== wallet.id ||
      shadowFacts.owner.accountId !== account.id ||
      (network.isAllNetworks
        ? shadowFacts.owner.network.kind !== 'allNetworks'
        : shadowFacts.owner.network.kind !== 'singleNetwork' ||
          shadowFacts.owner.network.networkId !== network.id)
    ) {
      return undefined;
    }
    const ownerKey = `${account.id}__${network.id}`;
    const isWorthOwnerCurrent =
      accountWorth.accountId === account.id ||
      accountWorth.accountId === indexedAccount?.id;
    const portfolioSourceCurrency =
      accountWorth.currency ?? settings.currencyInfo.id;
    const deFiSourceCurrency =
      accountDeFiOverview.currency || settings.currencyInfo.id;
    const confirmedSourceCurrency =
      lastConfirmed.currency ?? settings.currencyInfo.id;
    const portfolioRateIdentity = buildHomeBalanceQuoteRateIdentity({
      currencyMap,
      sourceCurrency: portfolioSourceCurrency,
      targetCurrency: USD_CURRENCY_ID,
    });
    const deFiRateIdentity = buildHomeBalanceQuoteRateIdentity({
      currencyMap,
      sourceCurrency: deFiSourceCurrency,
      targetCurrency: USD_CURRENCY_ID,
    });
    const confirmedRateIdentity = buildHomeBalanceQuoteRateIdentity({
      currencyMap,
      sourceCurrency: confirmedSourceCurrency,
      targetCurrency: USD_CURRENCY_ID,
    });
    const quoteBasis = {
      currency: USD_CURRENCY_ID,
      pricingRevision: stringUtils.stableStringify(
        [
          confirmedRateIdentity,
          portfolioRateIdentity,
          deFiRateIdentity,
        ].toSorted(),
      ),
    };
    const usesAggregateWorth = Boolean(
      network.isAllNetworks || vaultSettings?.mergeDeriveAssetsEnabled,
    );
    const currentWorthKey = usesAggregateWorth
      ? undefined
      : accountUtils.buildAccountValueKey({
          accountId: account.id,
          networkId: network.id,
        });
    const portfolioWorth = selectHomePortfolioWorth({
      currentWorthKey,
      usesAggregateWorth,
      worth: accountWorth.worth,
    });
    const hasCurrentWorthKey = portfolioWorth.sourcePresent;
    const portfolioTotal = new BigNumber(portfolioWorth.amount);
    const portfolioTotalUsd = resolveHomeBalanceQuotedAmount({
      currencyMap,
      value: portfolioTotal.toFixed(),
      sourceCurrency: portfolioSourceCurrency,
      targetCurrency: USD_CURRENCY_ID,
    });
    const deFiTotal = new BigNumber(accountDeFiOverview.netWorth ?? 0);
    const deFiTotalUsd = resolveHomeBalanceQuotedAmount({
      currencyMap,
      value: deFiTotal.isFinite() ? deFiTotal.toFixed() : 'NaN',
      sourceCurrency: deFiSourceCurrency,
      targetCurrency: USD_CURRENCY_ID,
    });
    const structureOwnerMatches =
      listStructure.ownerKey === ownerKey ||
      (!!indexedAccount?.id &&
        listStructure.ownerKey === `${indexedAccount.id}__${network.id}`);
    const hasHoldings =
      structureOwnerMatches && listStructure.fundedIds.length > 0;
    const hasNonZeroPortfolioWorth = !portfolioTotal.isZero();
    let isPortfolioComplete = false;
    if (isWorthOwnerCurrent && accountWorth.initialized) {
      if (usesAggregateWorth) {
        isPortfolioComplete = Boolean(accountWorth.updateAll);
      } else {
        isPortfolioComplete = hasCurrentWorthKey;
      }
    }
    let portfolioStatus: 'loading' | 'partial' | 'success' | 'empty' =
      'loading';
    if (!portfolioTotalUsd) {
      portfolioStatus =
        hasHoldings || hasNonZeroPortfolioWorth ? 'partial' : 'loading';
    } else if (
      isPortfolioComplete &&
      !(hasHoldings && !hasNonZeroPortfolioWorth)
    ) {
      portfolioStatus = hasNonZeroPortfolioWorth ? 'success' : 'empty';
    } else if (
      isWorthOwnerCurrent &&
      ((usesAggregateWorth && Object.keys(accountWorth.worth).length > 0) ||
        hasHoldings)
    ) {
      portfolioStatus = 'partial';
    }
    const isDeFiOwnerCurrent =
      accountDeFiOverview.accountId === account.id &&
      accountDeFiOverview.networkId === network.id &&
      deFiState.ownerKey === ownerKey;
    let deFiStatus: 'loading' | 'partial' | 'success' | 'empty' = 'loading';
    if (!deFiTotalUsd) {
      deFiStatus = !deFiTotal.isZero() ? 'partial' : 'loading';
    } else if (isDeFiOwnerCurrent && deFiState.isReady !== undefined) {
      deFiStatus = !deFiTotal.isZero() ? 'success' : 'empty';
    } else if (isDeFiOwnerCurrent && !deFiTotal.isZero()) {
      deFiStatus = 'partial';
    }
    const isPerpsCapabilityReady = shadowFacts.capabilityInputs.ready;
    const isPerpsSupported =
      shadowFacts.capabilityInputs.serverConfig.perps &&
      shadowFacts.capabilityInputs.productAvailability.perps;
    const shouldIncludePerps = !isPerpsCapabilityReady || isPerpsSupported;
    const confirmedValue = lastConfirmed.byOwner[ownerKey];
    const confirmedUsd = confirmedValue
      ? resolveHomeBalanceQuotedAmount({
          currencyMap,
          value: confirmedValue,
          sourceCurrency: confirmedSourceCurrency,
          targetCurrency: USD_CURRENCY_ID,
        })?.amount
      : undefined;
    const requiredSetRevision = `legacy-overview:v1:${
      network.isAllNetworks ? 'all' : network.id
    }`;
    const balance = adaptCurrentHomeBalanceFacts({
      bannerAvailable:
        banners.length > 0 ||
        Boolean(vaultSettings?.hasResource && account.id && network.id),
      compatibilityConfirmedAmount: confirmedUsd,
      contributors: [
        {
          amount: portfolioTotalUsd?.amount,
          coverageFingerprint: stringUtils.stableStringify({
            updateAll: accountWorth.updateAll,
            worthKeys: Object.keys(accountWorth.worth).toSorted(),
          }),
          expectedSourceScopeKey: ownerKey,
          id: 'portfolio',
          included: true,
          positiveEvidence: hasHoldings || hasNonZeroPortfolioWorth,
          sourceIdentity: 'legacy-overview-aggregate:v1',
          sourceScopeKey:
            (isWorthOwnerCurrent &&
              (usesAggregateWorth || hasCurrentWorthKey)) ||
            structureOwnerMatches
              ? ownerKey
              : accountWorth.accountId,
          status: portfolioStatus,
        },
        {
          amount: deFiTotalUsd?.amount,
          coverageFingerprint: stringUtils.stableStringify({
            isReady: deFiState.isReady,
            netWorth: accountDeFiOverview.netWorth,
          }),
          expectedSourceScopeKey: ownerKey,
          id: 'defi',
          included: true,
          positiveEvidence: !deFiTotal.isZero(),
          sourceIdentity: 'legacy-overview-defi:v1',
          sourceScopeKey: isDeFiOwnerCurrent ? ownerKey : deFiState.ownerKey,
          status: deFiStatus,
        },
        {
          coverageFingerprint: `perps-capability:${
            isPerpsCapabilityReady ? String(isPerpsSupported) : 'unknown'
          }`,
          expectedSourceScopeKey: ownerKey,
          id: 'perps',
          included: shouldIncludePerps,
          positiveEvidence: false,
          sourceIdentity: 'legacy-overview-perps-compatibility:v1',
          sourceScopeKey: ownerKey,
          status: 'loading',
        },
      ],
      ownerToken: shadowFacts.ownerToken,
      quoteBasis,
      requiredSetRevision: `${requiredSetRevision}:perps:${
        isPerpsCapabilityReady ? String(isPerpsSupported) : 'unknown'
      }`,
    });
    return {
      ...shadowFacts,
      balance,
      environment: {
        ...shadowFacts.environment,
        currency: USD_CURRENCY_ID,
      },
    };
  }, [
    account?.id,
    accountDeFiOverview,
    accountWorth,
    banners.length,
    currencyMap,
    deFiState.isReady,
    deFiState.ownerKey,
    indexedAccount?.id,
    lastConfirmed.byOwner,
    lastConfirmed.currency,
    listStructure.fundedIds.length,
    listStructure.ownerKey,
    network?.id,
    network?.isAllNetworks,
    settings.currencyInfo.id,
    shadowFacts,
    vaultSettings?.hasResource,
    vaultSettings?.mergeDeriveAssetsEnabled,
    wallet?.id,
  ]);
}

export { useHomeBalanceFacts };
