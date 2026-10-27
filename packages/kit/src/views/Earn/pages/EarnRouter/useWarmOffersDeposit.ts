import { useCallback } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { preloadModalNavigator } from '@onekeyhq/kit/src/routes/Modal/lazyModalNavigator';
import {
  useActiveAccount,
  useSelectedAccount,
} from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import earnUtils from '@onekeyhq/shared/src/utils/earnUtils';
import type { ISupportedSymbol } from '@onekeyhq/shared/types/earn';
import { ECheckAmountActionType } from '@onekeyhq/shared/types/staking';

import {
  EManagePositionType,
  warmManagePageData,
} from '../../../Staking/pages/ManagePosition/hooks/useManagePage';
import { preloadManagePosition } from '../../../Staking/router';
import { resolveStakeTokenAddress } from '../../../Staking/utils/utils';

import {
  buildEmptyAmountFirstFrameKey,
  buildOffersFirstFrameKey,
  buildSupplyEmptyFirstFrameKey,
  keepFirstFrame,
  warmFirstFrame,
} from './earnFirstFrameCache';

import type { IEarnDesktopHoldOffer } from '../../components/desktopHome/earnDesktopHome.utils';

// The deposit page's code and the app's modal navigator it opens in (loaded
// with the first modal otherwise, about 0.3 s on a page's first open). A
// failure is left to the open, which loads them again
function preloadDepositPage() {
  preloadModalNavigator().catch(() => undefined);
  preloadManagePosition().catch(() => undefined);
}

type IWarmTarget = {
  symbol: string;
  networkId: string;
  offers: IEarnDesktopHoldOffer[];
};

type IWarmFormTarget = {
  symbol: string;
  networkId: string;
  // The protocol's own name ("morpho"), as the form sends it
  providerName: string;
  vault?: string;
};

// The accounts the deposit page reads with (ManagePosition's own pick)
function useDepositPageAccounts() {
  const { activeAccount } = useActiveAccount({ num: 0 });
  const { selectedAccount } = useSelectedAccount({ num: 0 });
  return {
    accountId: activeAccount.account?.id,
    othersWalletAccountId: selectedAccount.othersWalletAccountId,
    indexedAccountId:
      selectedAccount.indexedAccountId || activeAccount.indexedAccount?.id,
  };
}

// The params a deposit form reads its data with, as the deposit modal and
// the deposit page pass them
export type IWarmFormParams = {
  accountId: string;
  indexedAccountId?: string;
  networkId: string;
  symbol: string;
  provider: string;
  vault?: string;
  type?: EManagePositionType;
  marketAddress?: string;
  reserveAddress?: string;
};

// The form's data, then its rows before an amount: a vault's or a staking
// protocol's, or a lending market's (My Supply; with loans, Health Factor
// and Use as Collateral), which its form also stands in place when it opens
// with an amount, until its own answer
export function warmFormData(params: IWarmFormParams) {
  const { networkId, symbol, provider: providerName, vault, type } = params;
  const { accountId, marketAddress, reserveAddress } = params;
  if (
    type === EManagePositionType.Supply &&
    accountId &&
    marketAddress &&
    reserveAddress !== undefined
  ) {
    warmFirstFrame(
      buildSupplyEmptyFirstFrameKey({
        accountId,
        networkId,
        provider: providerName,
        marketAddress,
        reserveAddress,
      }),
      () =>
        backgroundApiProxy.serviceStaking.getBorrowTransactionConfirmation({
          networkId,
          provider: providerName,
          marketAddress,
          reserveAddress,
          accountId,
          action: 'supply',
          amount: '0',
        }),
    ).catch(() => undefined);
  }
  void warmManagePageData({
    ...params,
    indexedAccountId: params.indexedAccountId,
    vault,
    symbol: symbol as ISupportedSymbol,
  }).then((data) => {
    const accountAddress = data?.earnAccount?.accountAddress;
    // Pendle's rows depend on the tokens it is quoted between
    if (
      !accountAddress ||
      (type && type !== EManagePositionType.Staking) ||
      earnUtils.isPendleProvider({ providerName })
    ) {
      return;
    }
    const token = data.managePageData?.deposit?.data?.token?.info;
    const tokenSymbol = token?.symbol || symbol;
    // The form names the vault only to protocols that take one
    const rowsVault = earnUtils.shouldSendEarnProtocolVault({ providerName })
      ? vault
      : undefined;
    warmFirstFrame(
      buildEmptyAmountFirstFrameKey({
        networkId,
        providerName,
        symbol: tokenSymbol,
        vault: rowsVault,
      }),
      () =>
        backgroundApiProxy.serviceStaking.getTransactionConfirmation({
          networkId,
          provider: providerName,
          symbol: tokenSymbol,
          vault: rowsVault || '',
          accountAddress,
          action: ECheckAmountActionType.STAKING,
          amount: '0',
          // As the form asks: the token it stakes, nothing it receives
          inputTokenAddress: resolveStakeTokenAddress({
            address: token?.address,
            isNative: token?.isNative,
          }),
          outputTokenAddress: '',
        }),
    ).catch(() => undefined);
  });
}

/**
 * Gets the deposit page ready for one protocol before it opens, as from a
 * details page's Deposit button: the page's code, the form's data and its
 * rows before an amount
 */
export function useWarmDepositForm() {
  const { othersWalletAccountId, indexedAccountId } = useDepositPageAccounts();
  return useCallback(
    (target: IWarmFormTarget) => {
      preloadDepositPage();
      warmFormData({
        accountId: othersWalletAccountId || '',
        indexedAccountId,
        networkId: target.networkId,
        symbol: target.symbol,
        provider: target.providerName,
        vault: target.vault,
      });
    },
    [indexedAccountId, othersWalletAccountId],
  );
}

/**
 * Gets the deposit modal ready for a token on a network before it opens:
 * the page's code, the token's offers as the home counted them, and for the
 * offer it opens on, the form's data and its rows before an amount. So its
 * first frame is the whole form. `withData` false keeps to what needs no
 * request
 */
export function useWarmOffersDeposit() {
  const { accountId, othersWalletAccountId, indexedAccountId } =
    useDepositPageAccounts();

  return useCallback(
    (
      { symbol, networkId, offers }: IWarmTarget,
      { withData = true }: { withData?: boolean } = {},
    ) => {
      preloadDepositPage();
      keepFirstFrame(
        buildOffersFirstFrameKey({ accountId, networkId, symbol }),
        offers.length ? offers : undefined,
      );
      const [offer] = offers;
      // A lending market's form reads its account first; it loads on open
      if (!withData || !offer || offer.kind === 'lending') {
        return;
      }
      const providerName = offer.item.provider.name;
      const vault = earnUtils.shouldSendEarnProtocolVault({ providerName })
        ? offer.item.provider.vault
        : undefined;
      warmFormData({
        accountId: othersWalletAccountId || '',
        indexedAccountId,
        networkId,
        symbol,
        provider: providerName,
        vault,
      });
    },
    [accountId, indexedAccountId, othersWalletAccountId],
  );
}
