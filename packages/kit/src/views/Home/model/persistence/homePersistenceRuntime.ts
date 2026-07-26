import BigNumber from 'bignumber.js';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  accountDeFiOverviewAtom,
  accountOverviewStateAtom,
  accountWorthAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/accountOverview';
import type { IAccountSelectorActiveAccountInfo } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import type { IJotaiContextStore } from '@onekeyhq/kit/src/states/jotai/utils/createJotaiContext';
import { convertFiat } from '@onekeyhq/kit/src/utils/fiatConvert';
import { tokenSelectorFilterPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { USD_CURRENCY_ID } from '@onekeyhq/shared/src/consts/currencyConsts';
import { WALLET_TYPE_HD } from '@onekeyhq/shared/src/consts/dbConsts';
import { SHOW_WALLET_FUNCTION_BLOCK_VALUE_THRESHOLD_USD } from '@onekeyhq/shared/src/consts/walletConsts';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import type { ICurrencyItem } from '@onekeyhq/shared/types';

import { createHomeAuthorityId } from '../core/homeIdentity';
import { HOME_PORTFOLIO_SHOW_LP_TOKENS_CONTROL_ID } from '../sections/spot/homePortfolioControls';
import { readHomeStoreSectionPayload } from '../store/homeStoreJson';

import type { IHomeSpotLegacyPayload } from '../sections/spot/homeSpotSourceAdapter';
import type {
  IHomeDispatchReceipt,
  IHomeStoreEvent,
  IHomeStoreState,
} from '../store/homeStoreTypes';

interface IHomePersistenceEnvironment {
  activeAccount: IAccountSelectorActiveAccountInfo;
  currencyMap: Record<string, ICurrencyItem>;
}

interface IHomePersistenceRuntimeHost {
  dispatch(event: IHomeStoreEvent): IHomeDispatchReceipt;
  getState(): IHomeStoreState;
}

export class HomePersistenceRuntime {
  private environment: IHomePersistenceEnvironment | undefined;

  private overviewStore: IJotaiContextStore | undefined;

  private hydratedControlSessionId: string | undefined;

  private hydratingControlSessionId: string | undefined;

  private persistedControlValue: boolean | undefined;

  private persistingControlValue: boolean | undefined;

  private previousWalletId: string | undefined;

  private lastOverviewKey = '';

  private lastAccountPersistenceKey = '';

  private disposed = false;

  constructor(private readonly host: IHomePersistenceRuntimeHost) {}

  updateEnvironment(
    environment: IHomePersistenceEnvironment,
    overviewStore: IJotaiContextStore,
  ): void {
    if (this.disposed) {
      return;
    }
    this.environment = environment;
    this.overviewStore = overviewStore;
    this.resetOverviewIfRequired();
    this.onStoreCommit(this.host.getState());
  }

  onStoreCommit(state: IHomeStoreState): void {
    if (this.disposed || !this.environment || !this.overviewStore) {
      return;
    }
    const sessionId = state.session.ownerToken?.sessionId;
    if (!sessionId || !state.facts) {
      this.hydratedControlSessionId = undefined;
      this.hydratingControlSessionId = undefined;
      return;
    }
    this.reconcilePortfolioControl(state, sessionId);
    this.reconcileAccountValue(state, sessionId);
  }

  dispose(): void {
    this.disposed = true;
    this.environment = undefined;
    this.overviewStore = undefined;
    this.hydratedControlSessionId = undefined;
    this.hydratingControlSessionId = undefined;
  }

  private reconcilePortfolioControl(
    state: IHomeStoreState,
    sessionId: string,
  ): void {
    const runtimeValue =
      state.interaction.sectionControls.portfolio?.[
        HOME_PORTFOLIO_SHOW_LP_TOKENS_CONTROL_ID
      ];
    if (
      typeof runtimeValue !== 'boolean' &&
      this.hydratedControlSessionId !== sessionId &&
      this.hydratingControlSessionId !== sessionId
    ) {
      this.hydratingControlSessionId = sessionId;
      void tokenSelectorFilterPersistAtom.get().then(
        (persisted) => {
          if (
            this.disposed ||
            this.host.getState().session.ownerToken?.sessionId !== sessionId
          ) {
            return;
          }
          const value = Boolean(persisted.homeShowLpTokensOnly);
          this.persistedControlValue = value;
          const current = this.host.getState();
          const facts = current.facts;
          if (!facts) {
            return;
          }
          const receipt = this.host.dispatch({
            type: 'intentReceived',
            intent: {
              type: 'sectionControlChanged',
              intentId: createHomeAuthorityId('intent'),
              owner: facts.owner,
              sessionId,
              sectionId: 'portfolio',
              controlId: HOME_PORTFOLIO_SHOW_LP_TOKENS_CONTROL_ID,
              value,
              authority: {
                kind: 'sectionCommands',
                sectionId: 'portfolio',
                revision: current.sections.portfolio.sectionCommandRevision,
              },
            },
          });
          if (receipt.accepted) {
            this.hydratedControlSessionId = sessionId;
          }
          if (this.hydratingControlSessionId === sessionId) {
            this.hydratingControlSessionId = undefined;
          }
        },
        () => {
          if (this.hydratingControlSessionId === sessionId) {
            this.hydratingControlSessionId = undefined;
          }
        },
      );
      return;
    }
    if (
      typeof runtimeValue !== 'boolean' ||
      (this.hydratedControlSessionId !== sessionId &&
        this.hydratingControlSessionId === sessionId)
    ) {
      return;
    }
    if (this.hydratedControlSessionId !== sessionId) {
      this.hydratedControlSessionId = sessionId;
    }
    if (
      runtimeValue === this.persistedControlValue ||
      runtimeValue === this.persistingControlValue
    ) {
      return;
    }
    this.persistingControlValue = runtimeValue;
    void tokenSelectorFilterPersistAtom
      .set((previous) => ({
        ...previous,
        homeShowLpTokensOnly: runtimeValue,
      }))
      .then(
        () => {
          this.persistedControlValue = runtimeValue;
          if (this.persistingControlValue === runtimeValue) {
            this.persistingControlValue = undefined;
          }
        },
        () => {
          if (this.persistingControlValue === runtimeValue) {
            this.persistingControlValue = undefined;
          }
        },
      );
  }

  private reconcileAccountValue(
    state: IHomeStoreState,
    sessionId: string,
  ): void {
    const { account, indexedAccount, network } =
      this.environment?.activeAccount ?? {};
    if (!account || !network || !this.overviewStore) {
      return;
    }
    const resource = state.resources.portfolio;
    const payload =
      resource.kind === 'ready' || resource.kind === 'partial'
        ? readHomeStoreSectionPayload<IHomeSpotLegacyPayload>(resource.data)
        : undefined;
    if (!payload) {
      return;
    }
    const accountValueOwnerId = payload.mergeDeriveAddressData
      ? indexedAccount?.id
      : account.id;
    if (!accountValueOwnerId) {
      return;
    }
    const overviewKey = [
      sessionId,
      payload.generation,
      payload.accountTokensWorthCurrency ?? USD_CURRENCY_ID,
      Object.keys(payload.accountWorthByNetwork ?? {}).length,
    ].join(':');
    if (overviewKey !== this.lastOverviewKey) {
      this.lastOverviewKey = overviewKey;
      this.overviewStore.set(accountWorthAtom(), {
        worth: payload.accountWorthByNetwork ?? {},
        createAtNetworkWorth: payload.createAtNetworkWorth ?? '0',
        initialized: true,
        accountId: accountValueOwnerId,
        updateAll: Boolean(network.isAllNetworks),
        currency: payload.accountTokensWorthCurrency ?? USD_CURRENCY_ID,
      });
      this.overviewStore.set(accountOverviewStateAtom(), {
        initialized: true,
        isRefreshing: false,
      });
    }
    if (overviewKey === this.lastAccountPersistenceKey) {
      return;
    }
    this.lastAccountPersistenceKey = overviewKey;
    void this.persistAccountValue(payload).catch(() => undefined);
  }

  private resetOverviewIfRequired(): void {
    const { account, network, wallet } = this.environment?.activeAccount ?? {};
    if (!account?.id || !network?.id || !wallet?.id || !this.overviewStore) {
      return;
    }
    const walletChanged =
      this.previousWalletId !== undefined &&
      this.previousWalletId !== wallet.id;
    this.previousWalletId = wallet.id;
    if (
      !walletChanged &&
      !network.isAllNetworks &&
      !(wallet.type === WALLET_TYPE_HD && !wallet.backuped)
    ) {
      return;
    }
    this.lastOverviewKey = '';
    this.lastAccountPersistenceKey = '';
    this.overviewStore.set(accountWorthAtom(), {
      worth: {},
      createAtNetworkWorth: '0',
      initialized: false,
      accountId: account.id,
      updateAll: false,
      currency: USD_CURRENCY_ID,
    });
    this.overviewStore.set(accountOverviewStateAtom(), {
      initialized: false,
      isRefreshing: false,
    });
    this.overviewStore.set(accountDeFiOverviewAtom(), {
      totalValue: 0,
      totalDebt: 0,
      totalReward: 0,
      netWorth: 0,
      currency: USD_CURRENCY_ID,
      accountId: account.id,
      networkId: network.id,
    });
  }

  private async persistAccountValue(
    payload: IHomeSpotLegacyPayload,
  ): Promise<void> {
    const { account, network, wallet } = this.environment?.activeAccount ?? {};
    if (!account || !network || !wallet) {
      return;
    }
    const worth = payload.accountWorthByNetwork ?? {};
    const sourceCurrency =
      payload.accountTokensWorthCurrency ?? USD_CURRENCY_ID;
    const allWorth = Object.values(worth)
      .reduce<BigNumber>((total, value) => total.plus(value), new BigNumber(0))
      .toFixed();
    const allWorthUsd = convertFiat({
      value: allWorth,
      sourceCurrency,
      targetCurrency: USD_CURRENCY_ID,
      currencyMap: this.environment?.currencyMap ?? {},
    });
    if (
      new BigNumber(allWorthUsd).gt(
        SHOW_WALLET_FUNCTION_BLOCK_VALUE_THRESHOLD_USD,
      )
    ) {
      try {
        await backgroundApiProxy.serviceWalletStatus.updateWalletStatus({
          walletXfp: wallet.xfp ?? '',
          status: { hasValue: true },
        });
        appEventBus.emit(EAppEventBusNames.AccountValueUpdate, undefined);
      } catch {
        // Account value profile persistence must continue independently.
      }
    }
    const isOthers = accountUtils.isOthersAccount({ accountId: account.id });
    const accountValueId = isOthers ? account.id : account.indexedAccountId;
    if (!accountValueId) {
      return;
    }
    const profileWrites: Promise<unknown>[] = [];
    if (
      isOthers &&
      account.createAtNetwork &&
      (network.isAllNetworks || account.createAtNetwork === network.id)
    ) {
      profileWrites.push(
        backgroundApiProxy.serviceAccountProfile.updateAccountValue({
          accountId: accountValueId,
          networkAccountId: account.id,
          networkId: account.createAtNetwork,
          value: payload.createAtNetworkWorth ?? '0',
          currency: sourceCurrency,
          shouldUpdateActiveAccountValue: true,
        }),
      );
    } else if (!isOthers && !network.isAllNetworks) {
      const value =
        worth[
          accountUtils.buildAccountValueKey({
            accountId: account.id,
            networkId: network.id,
          })
        ];
      profileWrites.push(
        backgroundApiProxy.serviceAccountProfile.updateAccountValueForSingleNetwork(
          {
            accountId: accountValueId,
            networkAccountId: account.id,
            networkId: network.id,
            value: value ?? '0',
            currency: sourceCurrency,
          },
        ),
      );
    }
    profileWrites.push(
      backgroundApiProxy.serviceAccountProfile.updateAllNetworkAccountValue({
        accountId: accountValueId,
        value: worth,
        currency: sourceCurrency,
        updateAll: Boolean(network.isAllNetworks),
      }),
    );
    await Promise.allSettled(profileWrites);
  }
}
