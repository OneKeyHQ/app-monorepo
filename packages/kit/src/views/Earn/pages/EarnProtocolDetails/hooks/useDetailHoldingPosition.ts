import { useCallback, useMemo, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useEarnPortfolioPositionsAtom } from '@onekeyhq/kit/src/states/jotai/contexts/earn';
import type { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IEarnPortfolioPositionsResponse } from '@onekeyhq/shared/types/earn/portfolioPositions';
import type { IProtocolInfo } from '@onekeyhq/shared/types/staking';

import { useEarnAccountKey } from '../../../hooks/useEarnAccountKey';
import {
  holdingPositionsOf,
  positionsScopeKey,
} from '../../EarnPositions/mobile/earnPortfolioPositions.utils';
import { buildHoldingView } from '../../EarnPositions/mobile/earnPositionModel';

import type { IEarnHoldingIdentity } from '../../EarnPositions/mobile/earnPortfolioPositions.utils';

/**
 * The holding the phone detail page shows, as the My portfolio card shows it
 * (product 10-14: the Portfolio tab's Balance and Rewards are that card).
 * It opens on what My portfolio cached for the wallet, then reads this
 * page's own positions scope (the page's earn account on its network, its
 * provider) on every `refresh`, and writes the result back to that cache so
 * the card is current when the user goes back. A failed read keeps what was
 * shown. `holding` is undefined until a position of this holding is known:
 * the page then falls back to the server's Portfolio groups.
 */
export function useDetailHoldingPosition({
  identity,
  earnAccount,
  enabled,
}: {
  identity: IEarnHoldingIdentity;
  earnAccount: IProtocolInfo['earnAccount'];
  enabled: boolean;
}) {
  const intl = useIntl();
  const earnAccountKey = useEarnAccountKey();
  const [cache, setCache] = useEarnPortfolioPositionsAtom();
  const [fresh, setFresh] = useState<
    { scopeKey: string; response: IEarnPortfolioPositionsResponse } | undefined
  >();

  const { networkId, provider } = identity;
  const accountId = earnAccount?.accountId;
  const accountAddress = earnAccount?.accountAddress;
  const publicKey = earnAccount?.account?.pub?.trim() || undefined;
  const scopeKey =
    enabled && accountId && accountAddress
      ? positionsScopeKey({ networkId, provider, accountAddress, publicKey })
      : undefined;
  // The account or the page can change while a read is in flight.
  const scopeKeyRef = useRef(scopeKey);
  scopeKeyRef.current = scopeKey;

  const refresh = useCallback(async () => {
    if (!scopeKey || !accountId || !accountAddress) {
      return;
    }
    try {
      const response =
        await backgroundApiProxy.serviceStaking.getPortfolioPositions({
          accountId,
          accountAddress,
          networkId,
          provider,
          ...(publicKey ? { publicKey } : {}),
        });
      if (scopeKeyRef.current !== scopeKey) {
        return;
      }
      setFresh({ scopeKey, response });
      if (earnAccountKey) {
        setCache((prev) => ({
          ...prev,
          [earnAccountKey]: { ...prev[earnAccountKey], [scopeKey]: response },
        }));
      }
    } catch {
      // Keep what the page showed; the next refresh retries.
    }
  }, [
    scopeKey,
    accountId,
    accountAddress,
    networkId,
    provider,
    publicKey,
    earnAccountKey,
    setCache,
  ]);

  const holding = useMemo(() => {
    if (!enabled) {
      return undefined;
    }
    const responses =
      fresh && fresh.scopeKey === scopeKey
        ? [fresh.response]
        : Object.values((earnAccountKey && cache[earnAccountKey]) || {});
    return buildHoldingView({
      sources: holdingPositionsOf(responses, identity),
      provider,
      translate: (id: ETranslations) => intl.formatMessage({ id }),
    });
  }, [
    enabled,
    fresh,
    scopeKey,
    earnAccountKey,
    cache,
    identity,
    provider,
    intl,
  ]);

  return { holding, refresh };
}
