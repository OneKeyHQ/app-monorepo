import { useMemo } from 'react';

import BigNumber from 'bignumber.js';

import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import {
  useHomeFacts,
  useHomeResource,
} from '@onekeyhq/kit/src/states/jotai/contexts/home';
import {
  useCurrencyPersistAtom,
  useSettingsPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { USD_CURRENCY_ID } from '@onekeyhq/shared/src/consts/currencyConsts';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';

import {
  isHomeBalanceContributorRefreshing,
  shouldIncludeHomeBalanceOptionalContributor,
} from '../balance/homeBalanceContributorPolicy';
import {
  adaptCurrentHomeBalanceFacts,
  buildHomeBalanceQuoteRateIdentity,
  resolveHomeBalanceQuotedAmount,
} from '../facts/currentHomeBalanceFactsAdapter';
import { readHomeBannerStorePayload } from '../sections/banner/homeBannerStoreModel';

import { useHomeSectionPayload } from './homeStoreHooks';

import type { IHomeFacts } from '../facts/homeFacts';

function useHomeBalanceFacts(): IHomeFacts | undefined {
  const storeFacts = useHomeFacts();
  const {
    activeAccount: { account, network, wallet },
  } = useActiveAccount({ num: 0 });
  const [{ currencyMap }] = useCurrencyPersistAtom();
  const [settings] = useSettingsPersistAtom();
  const portfolioResource = useHomeResource('portfolio');
  const perpsResource = useHomeResource('perps');
  const deFiResource = useHomeResource('defi');
  const bannerResource = useHomeResource('banner');
  const bannerPayload =
    bannerResource.kind === 'ready'
      ? readHomeBannerStorePayload(bannerResource.data)
      : undefined;
  const portfolioPayload = useHomeSectionPayload('portfolio');
  const perpsPayload = useHomeSectionPayload('perps');
  const deFiPayload = useHomeSectionPayload('defi');

  return useMemo(() => {
    if (
      !storeFacts ||
      !wallet?.id ||
      !account?.id ||
      !network?.id ||
      storeFacts.owner.walletId !== wallet.id ||
      storeFacts.owner.accountId !== account.id ||
      (network.isAllNetworks
        ? storeFacts.owner.network.kind !== 'allNetworks'
        : storeFacts.owner.network.kind !== 'singleNetwork' ||
          storeFacts.owner.network.networkId !== network.id)
    ) {
      return undefined;
    }
    const portfolioSourceCurrency =
      portfolioPayload?.accountTokensWorthCurrency ?? settings.currencyInfo.id;
    const deFiSourceCurrency =
      deFiPayload?.currency || settings.currencyInfo.id;
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
    const quoteBasis = {
      currency: USD_CURRENCY_ID,
      pricingRevision: stringUtils.stableStringify(
        [portfolioRateIdentity, deFiRateIdentity].toSorted(),
      ),
    };
    const portfolioTotal = new BigNumber(
      portfolioPayload?.accountTokensValue ?? 0,
    );
    const portfolioTotalUsd = resolveHomeBalanceQuotedAmount({
      currencyMap,
      value: portfolioTotal.isFinite() ? portfolioTotal.toFixed() : 'NaN',
      sourceCurrency: portfolioSourceCurrency,
      targetCurrency: USD_CURRENCY_ID,
    });
    const deFiTotal = new BigNumber(deFiPayload?.overview?.netWorth ?? 0);
    const deFiTotalUsd = resolveHomeBalanceQuotedAmount({
      currencyMap,
      value: deFiTotal.isFinite() ? deFiTotal.toFixed() : 'NaN',
      sourceCurrency: deFiSourceCurrency,
      targetCurrency: USD_CURRENCY_ID,
    });
    const hasHoldings = Boolean(portfolioPayload?.tokens.length);
    const hasNonZeroPortfolioWorth = !portfolioTotal.isZero();
    let portfolioStatus:
      | 'idle'
      | 'loading'
      | 'partial'
      | 'success'
      | 'empty'
      | 'error' =
      portfolioResource.kind === 'ready' ? 'loading' : portfolioResource.kind;
    if (portfolioResource.kind === 'ready') {
      if (!portfolioPayload) {
        portfolioStatus = 'loading';
      } else {
        portfolioStatus = hasNonZeroPortfolioWorth ? 'success' : 'empty';
      }
    } else if (portfolioResource.kind === 'partial' && !portfolioTotalUsd) {
      portfolioStatus = hasHoldings ? 'partial' : 'loading';
    }
    if (
      isHomeBalanceContributorRefreshing({
        kind: portfolioResource.kind,
        refresh:
          portfolioResource.kind === 'ready' ||
          portfolioResource.kind === 'empty'
            ? portfolioResource.refresh
            : undefined,
      })
    ) {
      portfolioStatus = 'partial';
    }
    let deFiStatus:
      | 'idle'
      | 'loading'
      | 'partial'
      | 'success'
      | 'empty'
      | 'error' = deFiResource.kind === 'ready' ? 'loading' : deFiResource.kind;
    if (deFiResource.kind === 'ready') {
      if (!deFiPayload) {
        deFiStatus = 'loading';
      } else {
        deFiStatus = deFiTotal.isZero() ? 'empty' : 'success';
      }
    } else if (deFiResource.kind === 'partial' && !deFiTotalUsd) {
      deFiStatus = deFiTotal.isZero() ? 'loading' : 'partial';
    }
    if (
      isHomeBalanceContributorRefreshing({
        kind: deFiResource.kind,
        refresh:
          deFiResource.kind === 'ready' || deFiResource.kind === 'empty'
            ? deFiResource.refresh
            : undefined,
      })
    ) {
      deFiStatus = 'partial';
    }
    const isCapabilityReady = storeFacts.capabilityInputs.ready;
    const isDeFiSupported =
      storeFacts.capabilityInputs.serverConfig.defi &&
      storeFacts.capabilityInputs.productAvailability.defi;
    const shouldIncludeDeFi = shouldIncludeHomeBalanceOptionalContributor({
      capabilityReady: isCapabilityReady,
      supported: isDeFiSupported,
    });
    const isPerpsSupported =
      storeFacts.capabilityInputs.serverConfig.perps &&
      storeFacts.capabilityInputs.productAvailability.perps;
    const shouldIncludePerps = shouldIncludeHomeBalanceOptionalContributor({
      capabilityReady: isCapabilityReady,
      supported: isPerpsSupported,
    });
    const perpsAmount = new BigNumber(perpsPayload?.view.accountValueUsd ?? 0);
    let perpsStatus:
      | 'idle'
      | 'loading'
      | 'partial'
      | 'success'
      | 'empty'
      | 'error' =
      perpsResource.kind === 'ready' ? 'loading' : perpsResource.kind;
    if (perpsResource.kind === 'ready' && perpsPayload) {
      perpsStatus = perpsAmount.isZero() ? 'empty' : 'success';
    } else if (perpsResource.kind === 'ready') {
      perpsStatus = 'loading';
    }
    if (
      isHomeBalanceContributorRefreshing({
        kind: perpsResource.kind,
        refresh:
          perpsResource.kind === 'ready' || perpsResource.kind === 'empty'
            ? perpsResource.refresh
            : undefined,
      })
    ) {
      perpsStatus = 'partial';
    }
    const expectedSourceScopeKey = storeFacts.ownerToken.scopeKey;
    const getResourceSourceScopeKey = (
      resource:
        | typeof portfolioResource
        | typeof perpsResource
        | typeof deFiResource,
    ) => {
      if (resource.kind === 'idle') {
        return undefined;
      }
      return (
        resource.token?.sourceKey.scopeKey ??
        (resource.kind === 'ready' || resource.kind === 'empty'
          ? expectedSourceScopeKey
          : undefined)
      );
    };
    const requiredSetRevision = `home-store-balance:v2:${
      network.isAllNetworks ? 'all' : network.id
    }`;
    const balance = adaptCurrentHomeBalanceFacts({
      bannerAvailable:
        Boolean(bannerPayload?.banners.length) ||
        Boolean(bannerPayload?.tronResource),
      contributors: [
        {
          amount: portfolioTotalUsd?.amount,
          coverageFingerprint:
            portfolioResource.kind === 'ready' ||
            portfolioResource.kind === 'partial' ||
            portfolioResource.kind === 'empty'
              ? portfolioResource.coverageFingerprint
              : undefined,
          errorKind:
            portfolioResource.kind === 'error'
              ? portfolioResource.errorKind
              : undefined,
          expectedSourceScopeKey,
          id: 'portfolio',
          included: true,
          positiveEvidence: hasHoldings || hasNonZeroPortfolioWorth,
          sourceIdentity:
            portfolioResource.kind === 'idle'
              ? 'home-store-portfolio:v1'
              : (portfolioResource.token?.sourceKey.paramsFingerprint ??
                'home-store-portfolio:v1'),
          sourceScopeKey: getResourceSourceScopeKey(portfolioResource),
          status: portfolioStatus,
        },
        {
          amount: deFiTotalUsd?.amount,
          coverageFingerprint:
            deFiResource.kind === 'ready' ||
            deFiResource.kind === 'partial' ||
            deFiResource.kind === 'empty'
              ? deFiResource.coverageFingerprint
              : undefined,
          errorKind:
            deFiResource.kind === 'error' ? deFiResource.errorKind : undefined,
          expectedSourceScopeKey,
          id: 'defi',
          included: shouldIncludeDeFi,
          positiveEvidence: !deFiTotal.isZero(),
          sourceIdentity:
            deFiResource.kind === 'idle'
              ? 'home-store-defi:v2'
              : (deFiResource.token?.sourceKey.paramsFingerprint ??
                'home-store-defi:v2'),
          sourceScopeKey: getResourceSourceScopeKey(deFiResource),
          status: deFiStatus,
        },
        {
          amount:
            perpsStatus === 'success' || perpsStatus === 'empty'
              ? perpsAmount.toFixed()
              : undefined,
          coverageFingerprint:
            perpsResource.kind === 'ready' || perpsResource.kind === 'empty'
              ? perpsResource.coverageFingerprint
              : `perps-capability:${
                  isCapabilityReady ? String(isPerpsSupported) : 'unknown'
                }`,
          errorKind:
            perpsResource.kind === 'error'
              ? perpsResource.errorKind
              : undefined,
          expectedSourceScopeKey,
          id: 'perps',
          included: shouldIncludePerps,
          positiveEvidence: perpsAmount.isGreaterThan(0),
          sourceIdentity:
            perpsResource.kind === 'idle'
              ? 'home-store-perps:v1'
              : (perpsResource.token?.sourceKey.paramsFingerprint ??
                'home-store-perps:v1'),
          sourceScopeKey: getResourceSourceScopeKey(perpsResource),
          status: perpsStatus,
        },
      ],
      ownerToken: storeFacts.ownerToken,
      quoteBasis,
      requiredSetRevision: `${requiredSetRevision}:defi:${
        isCapabilityReady ? String(isDeFiSupported) : 'unknown'
      }:perps:${isCapabilityReady ? String(isPerpsSupported) : 'unknown'}`,
    });
    return {
      ...storeFacts,
      balance,
      environment: {
        ...storeFacts.environment,
        currency: USD_CURRENCY_ID,
      },
    };
  }, [
    account?.id,
    bannerPayload,
    currencyMap,
    deFiPayload,
    deFiResource,
    network?.id,
    network?.isAllNetworks,
    perpsPayload,
    perpsResource,
    portfolioPayload,
    portfolioResource,
    settings.currencyInfo.id,
    storeFacts,
    wallet?.id,
  ]);
}

export { useHomeBalanceFacts };
