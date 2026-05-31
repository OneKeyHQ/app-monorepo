import { useCallback, useEffect, useRef, useState } from 'react';

import { BigNumber } from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Button,
  Divider,
  Icon,
  IconButton,
  NumberSizeableText,
  SizableText,
  Spinner,
  XStack,
  YStack,
  useClipboard,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountAvatar } from '@onekeyhq/kit/src/components/AccountAvatar';
import { Currency } from '@onekeyhq/kit/src/components/Currency';
import {
  useAccountSelectorActions,
  useActiveAccount,
  useSelectedAccount,
} from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { useShowDepositWithdrawModal } from '@onekeyhq/kit/src/views/Perp/hooks/useShowDepositWithdrawModal';
import {
  usePerpsActiveAccountAtom,
  usePerpsComputedAccountValueAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { PERPS_NETWORK_ID } from '@onekeyhq/shared/src/consts/perp';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { sumTokenGroupsFiatValueIgnoringUnavailable } from '@onekeyhq/shared/src/utils/tokenValueUtils';

import { WebAccountPanelFooter } from './atoms/WebAccountPanelFooter';
import { useWebDappRealAddress } from './useWebDappRealAddress';

// Session-only (in-memory) cache for the portfolio total, keyed by accountId.
// It survives the panel closing/reopening so reopening shows the last value
// instantly with no spinner; it is intentionally not persisted, so a full page
// reload starts fresh. A value older than PORTFOLIO_STALE_MS is refreshed
// silently in the background on the next open.
const PORTFOLIO_STALE_MS = 60 * 1000;
const portfolioCache = new Map<
  string,
  { value?: string; currency?: string; fetchedAt: number }
>();

// Same idea for the perps REST fallback value, keyed by userAddress: off the
// perps route the live atom is empty, so this avoids re-hitting the
// clearinghouse on every panel open within the stale window.
const PERPS_STALE_MS = 60 * 1000;
const perpsRestCache = new Map<string, { value?: string; fetchedAt: number }>();

export interface IWebAccountPanelMainProps {
  onNavigateAccountList: () => void;
  onNavigateSettings: () => void;
  onNavigateArticles: () => void;
  onHelp?: () => void;
  onDownloadApp?: () => void;
  onRequestClose: () => void;
}

function PerpsSection({
  userAddress,
  ensureActivePerpsAccount,
  onRequestClose,
}: {
  userAddress?: string;
  ensureActivePerpsAccount: () => Promise<void>;
  onRequestClose: () => void;
}) {
  const intl = useIntl();
  const { showDepositWithdrawModal } = useShowDepositWithdrawModal();

  // Prefer the live computed value — it's the exact source the header Trigger
  // pill renders, and it's correct for unified accounts (spot total). It's only
  // populated while the perps WebSocket is/was active (PerpsGlobalEffects). When
  // it hasn't resolved (e.g. a fresh non-perps route), fall back to a REST
  // clearinghouse fetch with a finite local loading flag — the WebSocket-only
  // spot total is unavailable there, so this is a best-effort approximation.
  const [perpsActiveAccount] = usePerpsActiveAccountAtom();
  const [computedValue] = usePerpsComputedAccountValueAtom();
  // The computed value is scoped to perpsActiveAccountAtom, which can still
  // describe a DIFFERENT account (e.g. opened Perps with account A, then
  // switched the panel to account B on Home/Earn). Only trust the atom when its
  // address matches this panel's account; otherwise treat it as unknown so the
  // REST fallback below fetches this account's value instead of showing A's.
  const isAtomForThisAccount =
    !!userAddress &&
    perpsActiveAccount?.accountAddress?.toLowerCase() ===
      userAddress.toLowerCase();
  const atomValue =
    isAtomForThisAccount && computedValue && !computedValue.isLoading
      ? computedValue.accountValue
      : undefined;

  const [restValue, setRestValue] = useState<string | undefined>(() =>
    userAddress ? perpsRestCache.get(userAddress)?.value : undefined,
  );
  const [isLoadingRest, setIsLoadingRest] = useState(false);
  // A user-initiated refresh always shows a spinner for feedback (even when the
  // live atom value is already on screen); background refreshes stay silent.
  const [isManualRefreshing, setIsManualRefreshing] = useState(false);

  // Ignore a REST result that resolves after the active address changed.
  const latestUserAddressRef = useRef(userAddress);
  latestUserAddressRef.current = userAddress;

  const fetchPerpsValue = useCallback(
    async (force?: boolean) => {
      if (!userAddress) {
        return;
      }
      const cached = perpsRestCache.get(userAddress);
      setRestValue(cached?.value);
      const isFresh =
        !!cached && Date.now() - cached.fetchedAt < PERPS_STALE_MS;
      if (!force && isFresh) {
        return;
      }
      const hasCachedValue = cached?.value !== undefined;
      if (force) {
        setIsManualRefreshing(true);
      }
      if (force || !hasCachedValue) {
        setIsLoadingRest(true);
      }
      try {
        const r = await backgroundApiProxy.serviceWebviewPerp.getAccountBalance(
          { userAddress },
        );
        if (r?.accountValue !== undefined) {
          perpsRestCache.set(userAddress, {
            value: r.accountValue,
            fetchedAt: Date.now(),
          });
        }
        if (latestUserAddressRef.current !== userAddress) {
          return;
        }
        setRestValue(r?.accountValue);
      } catch {
        // Keep the previous value on failure; just stop the spinner.
      } finally {
        setIsLoadingRest(false);
        setIsManualRefreshing(false);
      }
    },
    [userAddress],
  );

  // Only hit REST when the live atom hasn't resolved for this account.
  useEffect(() => {
    if (atomValue === undefined) {
      void fetchPerpsValue();
    }
  }, [atomValue, fetchPerpsValue]);

  const effectiveValue = atomValue ?? restValue;
  // Manual refresh → always spinner; background/first load → only when there's
  // no value to show yet.
  const showSpinner =
    isManualRefreshing || (atomValue === undefined && isLoadingRest);

  const renderPerpsValue = () => {
    if (showSpinner) {
      return <Spinner size="small" />;
    }
    if (effectiveValue === undefined) {
      return (
        <SizableText size="$bodyMdMedium" color="$text">
          --
        </SizableText>
      );
    }
    return (
      <NumberSizeableText
        size="$bodyMdMedium"
        color="$text"
        formatter="value"
        formatterOptions={{ currency: '$' }}
      >
        {effectiveValue}
      </NumberSizeableText>
    );
  };

  const handleDeposit = useCallback(async () => {
    // The deposit/withdraw dialog reads perpsActiveAccountAtom, which only
    // PerpsGlobalEffects populates on the /perps route. The panel surfaces the
    // Perps section on every web-dapp route, so initialize the active perps
    // account from this account first — otherwise the dialog errors with a
    // missing-account toast when opened off the perps route.
    await ensureActivePerpsAccount();
    await showDepositWithdrawModal('deposit');
    onRequestClose();
  }, [ensureActivePerpsAccount, showDepositWithdrawModal, onRequestClose]);

  const handleWithdraw = useCallback(async () => {
    await ensureActivePerpsAccount();
    await showDepositWithdrawModal('withdraw');
    onRequestClose();
  }, [ensureActivePerpsAccount, showDepositWithdrawModal, onRequestClose]);

  return (
    <YStack gap="$3" w="100%">
      <XStack ai="center" jc="space-between" gap="$1">
        <SizableText size="$bodyMd" color="$textSubdued" flex={1}>
          {intl.formatMessage({ id: ETranslations.global_perp })}
        </SizableText>
        <Button
          size="small"
          variant="tertiary"
          color="$text"
          childrenAsText={false}
          onPress={() => void fetchPerpsValue(true)}
          testID="web-account-panel-main-perps-balance"
        >
          {renderPerpsValue()}
        </Button>
      </XStack>
      <XStack ai="center" gap="$2" w="100%">
        <Button
          flex={1}
          size="small"
          variant="accent"
          onPress={handleDeposit}
          testID="web-account-panel-main-deposit"
        >
          {intl.formatMessage({ id: ETranslations.perp_trade_deposit })}
        </Button>
        <Button
          flex={1}
          size="small"
          variant="secondary"
          onPress={handleWithdraw}
          testID="web-account-panel-main-withdraw"
        >
          {intl.formatMessage({ id: ETranslations.perp_trade_withdraw })}
        </Button>
      </XStack>
    </YStack>
  );
}

export function WebAccountPanelMain({
  onNavigateAccountList,
  onNavigateSettings,
  onNavigateArticles,
  onHelp,
  onDownloadApp,
  onRequestClose,
}: IWebAccountPanelMainProps) {
  const intl = useIntl();
  const { copyText } = useClipboard();
  const actions = useAccountSelectorActions();
  const { selectedAccount } = useSelectedAccount({ num: 0 });
  const {
    activeAccount: { account, dbAccount, indexedAccount, wallet },
  } = useActiveAccount({ num: 0 });

  // In web-dapp all-networks mode an indexed account's address is a mock
  // placeholder; resolve the real EVM address for display, copy and perps.
  const realAddress = useWebDappRealAddress({
    address: account?.address,
    indexedAccountId: indexedAccount?.id,
  });

  // Portfolio total. The home page is the only place that computes account
  // worth (its page-scoped token-list flow), so on routes like /perps nothing
  // populates the cached worth. Fetch it regardless of route: enumerate the
  // networks this account is compatible with, fan out a live token fetch per
  // network, and sum the fiat values (already in the user's display currency).
  const [portfolio, setPortfolio] = useState<string | undefined>(() =>
    account?.id ? portfolioCache.get(account.id)?.value : undefined,
  );
  // The currency the summed fiatValue is expressed in (fetchAccountTokens
  // normalizes to 'usd'). Carried through so <Currency> converts it to the
  // user's display currency instead of mislabeling a USD total as e.g. EUR.
  const [portfolioCurrency, setPortfolioCurrency] = useState<
    string | undefined
  >(() => (account?.id ? portfolioCache.get(account.id)?.currency : undefined));
  const [isLoadingPortfolio, setIsLoadingPortfolio] = useState(false);

  // Ignore a fan-out result that resolves after the active account changed.
  const latestAccountIdRef = useRef(account?.id);
  latestAccountIdRef.current = account?.id;

  const fetchPortfolio = useCallback(
    async (force?: boolean) => {
      const accountId = account?.id;
      if (!accountId) {
        setPortfolio(undefined);
        return;
      }
      const cached = portfolioCache.get(accountId);
      // Reflect this account's cached value immediately — instant on reopen and
      // on account switch, with no spinner when we already have something.
      setPortfolio(cached?.value);
      setPortfolioCurrency(cached?.currency);
      const isFresh =
        !!cached && Date.now() - cached.fetchedAt < PORTFOLIO_STALE_MS;
      // Fresh enough (and not a manual refresh) → keep the cached value, no
      // network call at all.
      if (!force && isFresh) {
        return;
      }
      // Only show a spinner when there's nothing to display yet (first load for
      // this account) or the user explicitly asked to refresh; otherwise the
      // refresh happens silently with the cached value still on screen.
      const hasCachedValue = cached?.value !== undefined;
      if (force || !hasCachedValue) {
        setIsLoadingPortfolio(true);
      }
      try {
        // Intentionally EVM-only (product requirement): enumerate the EVM
        // mainnet networks this account is compatible with and fan out a live
        // token fetch per network. The chain selector returns networks matching
        // the (EVM-resolved) account, so non-EVM chains are excluded by design —
        // do NOT broaden this to all networks.
        const { mainnetItems } =
          await backgroundApiProxy.serviceNetwork.getChainSelectorNetworksCompatibleWithAccountId(
            { accountId, excludeTestNetwork: true },
          );
        // For an indexed account the all-networks accountId is a mock that fails
        // per-network token fetches, so resolve the real per-network account(s)
        // first (same as the Home token list). External/others accounts already
        // carry a real per-network accountId, so fetch with it directly.
        const indexedAccountId = indexedAccount?.id;
        const resultsByNetwork = await Promise.all(
          mainnetItems.map(async (net) => {
            if (indexedAccountId) {
              try {
                const { networkAccounts } =
                  await backgroundApiProxy.serviceAccount.getNetworkAccountsInSameIndexedAccountIdWithDeriveTypes(
                    {
                      networkId: net.id,
                      indexedAccountId,
                      excludeEmptyAccount: true,
                    },
                  );
                return Promise.all(
                  networkAccounts.map((networkAccount) =>
                    backgroundApiProxy.serviceToken
                      .fetchAccountTokens({
                        accountId: networkAccount.account?.id ?? '',
                        networkId: net.id,
                        indexedAccountId,
                        flag: 'web-account-panel-portfolio',
                      })
                      .catch(() => null),
                  ),
                );
              } catch {
                return [null];
              }
            }
            return [
              await backgroundApiProxy.serviceToken
                .fetchAccountTokens({
                  accountId,
                  networkId: net.id,
                  flag: 'web-account-panel-portfolio',
                })
                .catch(() => null),
            ];
          }),
        );
        const results = resultsByNetwork.flat();
        // Ignore a result that resolved after the active account changed.
        if (latestAccountIdRef.current !== accountId) {
          return;
        }
        const okResults = results.filter(
          (r): r is NonNullable<typeof r> => r !== null,
        );
        if (okResults.length === 0) {
          // Every request failed — keep any cached value rather than wiping it,
          // and don't refresh the timestamp so the next open retries.
          if (!hasCachedValue) {
            setPortfolio(undefined);
          }
          return;
        }
        // Use the shared helper (same one Home uses) so an unavailable/non-finite
        // group value from a partial provider failure is skipped instead of
        // poisoning the whole total to NaN.
        const total = okResults.reduce(
          (acc, r) =>
            acc.plus(
              new BigNumber(sumTokenGroupsFiatValueIgnoringUnavailable(r)),
            ),
          new BigNumber(0),
        );
        // Every per-network fetch uses the same display currency, so the
        // returned token-group currency is uniform; carry it so the total is
        // rendered in the basis it was actually summed in.
        const sourceCurrency =
          okResults.find((r) => r?.tokens?.currency)?.tokens?.currency ??
          okResults.find((r) => r?.smallBalanceTokens?.currency)
            ?.smallBalanceTokens?.currency;
        const value = total.toFixed();
        portfolioCache.set(accountId, {
          value,
          currency: sourceCurrency,
          fetchedAt: Date.now(),
        });
        setPortfolio(value);
        setPortfolioCurrency(sourceCurrency);
      } catch {
        // Keep the previous value on failure; just stop the spinner.
      } finally {
        setIsLoadingPortfolio(false);
      }
    },
    [account?.id, indexedAccount?.id],
  );

  useEffect(() => {
    void fetchPortfolio();
  }, [fetchPortfolio]);

  const address = realAddress
    ? accountUtils.shortenAddress({
        address: realAddress,
        leadingLength: 4,
        trailingLength: 4,
      })
    : '';

  const handleCopyAddress = useCallback(() => {
    if (realAddress) {
      copyText(realAddress);
    }
  }, [realAddress, copyText]);

  const handleDisconnect = useCallback(async () => {
    // Match the account-selector "Disconnect from dApp" action exactly
    // (AccountRemoveButton → actions.removeAccount). For an external/keyless
    // account this ends the connector session and runs autoSelectNextAccount
    // internally: it switches to the next available account (the panel stays
    // open showing it) or resets to the unconnected state if it was the last
    // one (the header swaps in the Connect button and this popover unmounts on
    // its own). It deliberately does NOT touch origin/storageType — the dApp
    // website-session flow lives in the connection modals, not the generic
    // account selector, so it's out of scope here.
    const connectedAccountId = selectedAccount?.othersWalletAccountId;
    if (connectedAccountId) {
      // Web dapp mode forces the active account to all-networks, so
      // useActiveAccount doesn't populate dbAccount; resolve from the id.
      const targetAccount =
        await backgroundApiProxy.serviceAccount.getDBAccountSafe({
          accountId: connectedAccountId,
        });
      if (targetAccount) {
        await actions.current.removeAccount({ account: targetAccount });
        return;
      }
    } else if (indexedAccount) {
      // An indexed/HD account selected as the home account: do NOT delete it.
      // removeAccount would wipe the HD account from local DB (and wouldn't
      // auto-switch — autoSelectNextAccount only runs for others accounts).
      // Disconnect here just resets the selection to unconnected; the account
      // stays in the wallet.
      await actions.current.clearSelectedAccount({
        num: 0,
        clearAccount: true,
      });
    }
    onRequestClose();
  }, [
    actions,
    indexedAccount,
    onRequestClose,
    selectedAccount?.othersWalletAccountId,
  ]);

  // Initialize the active perps account from this account before any perps
  // action. perpsActiveAccountAtom is otherwise only set by PerpsGlobalEffects
  // on the /perps route; this is the same call it makes (resolves the EVM
  // address from the account internally), so Deposit/Withdraw work on any
  // web-dapp page.
  const ensureActivePerpsAccount = useCallback(async () => {
    if (!account?.id && !indexedAccount?.id) {
      return;
    }
    const deriveType =
      await backgroundApiProxy.serviceNetwork.getGlobalDeriveTypeOfNetwork({
        networkId: PERPS_NETWORK_ID,
      });
    await backgroundApiProxy.serviceHyperliquid.changeActivePerpsAccount({
      indexedAccountId: indexedAccount?.id ?? null,
      accountId: account?.id ?? null,
      walletId: wallet?.id ?? null,
      deriveType,
    });
  }, [account?.id, indexedAccount?.id, wallet?.id]);

  const renderPortfolioValue = () => {
    if (isLoadingPortfolio) {
      return <Spinner size="small" />;
    }
    if (portfolio !== undefined) {
      return (
        <Currency
          sourceCurrency={portfolioCurrency}
          formatter="value"
          hideValue
          size="$bodyMdMedium"
          color="$text"
        >
          {portfolio}
        </Currency>
      );
    }
    return (
      <SizableText size="$bodyMdMedium" color="$text">
        --
      </SizableText>
    );
  };

  return (
    <YStack w="100%">
      <YStack p="$5" gap="$5" w="100%">
        <XStack ai="center" jc="space-between" w="100%" pb="$2.5">
          <XStack
            ai="center"
            gap="$2"
            px="$2"
            py="$1.5"
            mx="$-2"
            my="$-1.5"
            borderRadius="$4"
            userSelect="none"
            hoverStyle={{ bg: '$bgHover' }}
            pressStyle={{ bg: '$bgActive' }}
            onPress={onNavigateAccountList}
            role="button"
            testID="web-account-panel-main-account-trigger"
          >
            <AccountAvatar
              size="$6"
              borderRadius="$full"
              outlineWidth={1}
              outlineStyle="solid"
              outlineColor="$borderSubdued"
              outlineOffset={-1}
              account={account}
              dbAccount={dbAccount}
              indexedAccount={indexedAccount}
            />
            <SizableText size="$bodyLgMedium" color="$text" numberOfLines={1}>
              {address}
            </SizableText>
            <Icon name="SwitchHorOutline" size="$4.5" color="$iconSubdued" />
          </XStack>
          <XStack ai="center" gap="$5">
            <IconButton
              icon="Copy3Outline"
              size="small"
              variant="tertiary"
              iconSize="$5"
              title={intl.formatMessage({
                id: ETranslations.global_copy_address,
              })}
              onPress={handleCopyAddress}
              testID="web-account-panel-main-copy"
            />
            <IconButton
              icon="BrokenLink2Outline"
              size="small"
              variant="tertiary"
              iconSize="$5"
              title={intl.formatMessage({
                id: ETranslations.explore_disconnect,
              })}
              onPress={handleDisconnect}
              testID="web-account-panel-main-disconnect"
            />
          </XStack>
        </XStack>
        <XStack ai="center" jc="space-between" gap="$1" w="100%">
          <SizableText size="$bodyMd" color="$textSubdued" flex={1}>
            {intl.formatMessage({ id: ETranslations.global_portfolio })}
          </SizableText>
          <Button
            size="small"
            variant="tertiary"
            childrenAsText={false}
            onPress={() => void fetchPortfolio(true)}
            testID="web-account-panel-main-portfolio-balance"
          >
            {renderPortfolioValue()}
          </Button>
        </XStack>
        <Divider borderColor="$neutral3" />
        <PerpsSection
          userAddress={realAddress}
          ensureActivePerpsAccount={ensureActivePerpsAccount}
          onRequestClose={onRequestClose}
        />
      </YStack>
      <WebAccountPanelFooter
        connected
        onDownloadApp={onDownloadApp}
        onArticles={onNavigateArticles}
        onHelp={onHelp}
        onSettings={onNavigateSettings}
      />
    </YStack>
  );
}
