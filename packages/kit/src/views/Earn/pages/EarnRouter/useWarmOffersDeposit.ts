import { useCallback } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  useActiveAccount,
  useSelectedAccount,
} from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import earnUtils from '@onekeyhq/shared/src/utils/earnUtils';
import type { ISupportedSymbol } from '@onekeyhq/shared/types/earn';
import { ECheckAmountActionType } from '@onekeyhq/shared/types/staking';

import { warmManagePageData } from '../../../Staking/pages/ManagePosition/hooks/useManagePage';
import { preloadManagePosition } from '../../../Staking/router';
import { resolveStakeTokenAddress } from '../../../Staking/utils/utils';

import {
  buildEmptyAmountFirstFrameKey,
  buildOffersFirstFrameKey,
  keepFirstFrame,
  warmFirstFrame,
} from './earnFirstFrameCache';

import type { IEarnDesktopHoldOffer } from '../../components/desktopHome/earnDesktopHome.utils';

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

// The form's data, then its rows before an amount
function warmDepositFormData({
  othersWalletAccountId,
  indexedAccountId,
  symbol,
  networkId,
  providerName,
  vault,
}: IWarmFormTarget & {
  othersWalletAccountId?: string;
  indexedAccountId?: string;
}) {
  void warmManagePageData({
    accountId: othersWalletAccountId || '',
    indexedAccountId,
    networkId,
    symbol: symbol as ISupportedSymbol,
    provider: providerName,
    vault,
  }).then((data) => {
    const accountAddress = data?.earnAccount?.accountAddress;
    // Pendle's rows depend on the tokens it is quoted between
    if (!accountAddress || earnUtils.isPendleProvider({ providerName })) {
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
      preloadManagePosition().catch(() => undefined);
      warmDepositFormData({
        ...target,
        othersWalletAccountId,
        indexedAccountId,
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
      preloadManagePosition().catch(() => undefined);
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
      warmDepositFormData({
        othersWalletAccountId,
        indexedAccountId,
        symbol,
        networkId,
        providerName,
        vault,
      });
    },
    [accountId, indexedAccountId, othersWalletAccountId],
  );
}
