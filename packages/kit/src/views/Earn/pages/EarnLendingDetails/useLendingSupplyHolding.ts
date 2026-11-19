import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import type { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IBorrowMarketItem } from '@onekeyhq/shared/types/staking';

import { buildBorrowMarketKey } from '../../../Borrow/borrowMarketKey';
import { hasPositiveBorrowBalance } from '../../../Borrow/components/borrowRepayPosition.utils';
import { useRememberedAccountMarket } from '../../components/desktopHome/useEarnDesktopHomeData';
import {
  findSuppliedReserve,
  lendingSupplyPositionOf,
} from '../EarnPositions/mobile/earnLendingPositions';
import { buildHoldingView } from '../EarnPositions/mobile/earnPositionModel';

import type { IEarnDesktopAccountMarket } from '../../components/desktopHome/useEarnDesktopHomeData';

/**
 * The account's supply of a reserve, drawn as My portfolio draws a holding
 * (demo 10-29). It starts from what the DeFi home last read for the market,
 * then reads the market for the page's account, and again on `refresh`. A
 * failed read keeps what was shown
 */
export function useLendingSupplyHolding({
  market,
  accountId,
  provider,
  networkId,
  marketAddress,
  reserveAddress,
}: {
  market: IBorrowMarketItem | undefined;
  // The page's account on the market's network
  accountId: string | undefined;
  provider: string;
  networkId: string;
  marketAddress: string;
  reserveAddress: string;
}) {
  const intl = useIntl();
  const remembered = useRememberedAccountMarket(
    buildBorrowMarketKey({ provider, networkId, marketAddress }),
  );
  const rememberedHealthFactor = remembered?.healthFactor;

  const { result: read, run } = usePromiseResult(
    async () => {
      if (!accountId) {
        return undefined;
      }
      const params = { provider, networkId, marketAddress, accountId };
      const reserves =
        await backgroundApiProxy.serviceStaking.getBorrowReserves(params);
      const hasLoan = (reserves?.borrowed?.assets ?? []).some((asset) =>
        hasPositiveBorrowBalance(asset.borrowedAmount),
      );
      // The server sometimes answers with an empty object; the home's last
      // reading stands in, as on the home
      const healthFactor = hasLoan
        ? await backgroundApiProxy.serviceStaking
            .getBorrowHealthFactor(params)
            .then((data) =>
              data?.healthFactor?.text ? data : rememberedHealthFactor,
            )
            .catch(() => rememberedHealthFactor)
        : undefined;
      return { accountId, reserves, healthFactor };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [accountId, marketAddress, networkId, provider],
    { keepResultIfError: true },
  );

  // The page's own read once it has one for this account; until then the
  // home's, if it was for the same account
  const entry = useMemo<IEarnDesktopAccountMarket | undefined>(() => {
    const ownMarket = market ?? remembered?.market;
    if (read && read.accountId === accountId && ownMarket) {
      return {
        market: ownMarket,
        accountId: read.accountId,
        reserves: read.reserves,
        healthFactor: read.healthFactor,
      };
    }
    if (
      remembered?.reserves &&
      (!accountId || remembered.accountId === accountId)
    ) {
      return remembered;
    }
    return undefined;
  }, [accountId, market, read, remembered]);

  const holding = useMemo(() => {
    if (!entry) {
      return undefined;
    }
    const position = lendingSupplyPositionOf({ entry, reserveAddress });
    return position
      ? buildHoldingView({
          sources: [position],
          provider,
          translate: (id: ETranslations) => intl.formatMessage({ id }),
        })
      : undefined;
  }, [entry, intl, provider, reserveAddress]);

  // The row's Withdraw greys where the market's own does
  const withdrawDisabled = entry
    ? Boolean(
        findSuppliedReserve({ entry, reserveAddress })?.withdrawButton
          ?.disabled,
      )
    : false;

  const refresh = useCallback(() => run({ alwaysSetState: true }), [run]);

  return { holding, withdrawDisabled, refresh };
}
