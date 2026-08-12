import { useCallback, useId, useMemo, useRef } from 'react';

import { useIntl } from 'react-intl';
import { StyleSheet, useColorScheme } from 'react-native';

import { useReviewControl } from '@onekeyhq/kit/src/components/ReviewControl';
import { getTokenListOwnerCacheAccountId } from '@onekeyhq/kit/src/components/TokenListView/utils';
import { useOwnerScopedHomeBalanceState } from '@onekeyhq/kit/src/hooks/useHomeBalanceState';
import { useLastConfirmedOverviewBalanceAtom } from '@onekeyhq/kit/src/states/jotai/contexts/accountOverview';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { convertFiat } from '@onekeyhq/kit/src/utils/fiatConvert';
import {
  settingsValuePersistAtom,
  useCurrencyPersistAtom,
  useSettingsPersistAtom,
  useSettingsValuePersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  HomeContainer,
  type INativeHomeHeaderActionViewModel,
  type INativeHomeHeaderViewModel,
  type INativeHomeIntent,
  type INativeHomeOwnerToken,
  type INativeHomeViewModel,
  type NativeHomeHeaderActionId,
} from '@onekeyhq/native-components';
import { USD_CURRENCY_ID } from '@onekeyhq/shared/src/consts/currencyConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import {
  formatDisplayNumber,
  formatValue,
} from '@onekeyhq/shared/src/utils/numberUtils';
import type { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { HomeTokenListProviderMirrorWrapper } from '../components/HomeTokenListProvider';
import { useWalletActionSend } from '../components/WalletActions';
import { useWalletActionConfig } from '../components/WalletActions/useWalletActionConfig';
import { useWalletActionBuyMain } from '../components/WalletActions/WalletActionBuyMain';
import { useWalletActionMore } from '../components/WalletActions/WalletActionMore';
import { useWalletActionPerp } from '../components/WalletActions/WalletActionPerp';
import { useWalletActionReceive } from '../components/WalletActions/WalletActionReceive';
import { useWalletActionStaking } from '../components/WalletActions/WalletActionStaking';
import { useWalletActionSwap } from '../components/WalletActions/WalletActionSwap';
import { useHomeOverviewResolvedBalance } from '../hooks/useHomeOverviewResolvedBalance';

import { isNativeHomeIntentExecutable } from './nativeHomeIntentValidation';

import type { IWalletActionType } from '../components/WalletActions/types';

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

type IHeaderActionHandler = () => void | Promise<void>;
type IHeaderActionHandlers = Partial<
  Record<NativeHomeHeaderActionId, IHeaderActionHandler>
>;

function useNativeHomeOwnerToken(
  sceneName: EAccountSelectorSceneName,
): INativeHomeOwnerToken {
  const instanceId = useId();
  const sessionOrdinalRef = useRef(0);
  const sessionRef = useRef({ scopeKey: '', sessionId: '' });
  const {
    activeAccount: {
      account,
      indexedAccount,
      network,
      wallet,
      deriveInfoItems,
      vaultSettings,
    },
  } = useActiveAccount({ num: 0 });

  const mergeDeriveAddressData =
    vaultSettings?.mergeDeriveAssetsEnabled &&
    !accountUtils.isOthersWallet({ walletId: wallet?.id ?? '' }) &&
    deriveInfoItems.length > 1;
  const effectiveTokenOwnerId = getTokenListOwnerCacheAccountId({
    accountId: account?.id,
    indexedAccountId: indexedAccount?.id,
    mergeDeriveAddressData: !!mergeDeriveAddressData,
  });
  const scopeKey = [
    sceneName,
    wallet?.id ?? '',
    account?.id ?? '',
    effectiveTokenOwnerId ?? '',
    network?.id ?? '',
  ].join('|');

  if (sessionRef.current.scopeKey !== scopeKey) {
    sessionOrdinalRef.current += 1;
    sessionRef.current = {
      scopeKey,
      sessionId: `${instanceId}:${sessionOrdinalRef.current}`,
    };
  }

  return sessionRef.current;
}

function useNativeHomeHeaderBalance(): Pick<
  INativeHomeHeaderViewModel,
  'balanceActionEnabled' | 'balanceHidden' | 'balanceText' | 'state'
> {
  const ownerBalanceState = useOwnerScopedHomeBalanceState();
  const { ownerKey, resolvedBalanceUsd } = useHomeOverviewResolvedBalance();
  const [lastConfirmedBalance] = useLastConfirmedOverviewBalanceAtom();
  const [{ currencyMap }] = useCurrencyPersistAtom();
  const [settings] = useSettingsPersistAtom();
  const [settingsValue] = useSettingsValuePersistAtom();

  const exactOwnerCachedValue = lastConfirmedBalance.byOwner[ownerKey];
  const exactOwnerCachedUsd =
    exactOwnerCachedValue !== undefined
      ? convertFiat({
          value: exactOwnerCachedValue,
          sourceCurrency:
            lastConfirmedBalance.currency ?? settings.currencyInfo.id,
          targetCurrency: USD_CURRENCY_ID,
          currencyMap,
        })
      : undefined;
  const balanceUsd = resolvedBalanceUsd ?? exactOwnerCachedUsd;
  const displayValue =
    balanceUsd === undefined
      ? undefined
      : convertFiat({
          value: balanceUsd,
          sourceCurrency: USD_CURRENCY_ID,
          targetCurrency: settings.currencyInfo.id,
          currencyMap,
        });
  const balanceHidden = settingsValue.hideValue;
  const balanceText = useMemo(() => {
    if (displayValue === undefined) return '';
    if (balanceHidden) return '****';
    const formatted = formatDisplayNumber(
      formatValue(displayValue, { currency: settings.currencyInfo.symbol }),
    );
    return Array.isArray(formatted)
      ? formatted
          .map((part) => (typeof part === 'string' ? part : part.value))
          .join('')
      : formatted;
  }, [balanceHidden, displayValue, settings.currencyInfo.symbol]);

  return {
    balanceActionEnabled:
      ownerBalanceState !== 'unknown' && displayValue !== undefined,
    balanceHidden,
    balanceText,
    state: displayValue === undefined ? 'loading' : 'ready',
  };
}

function useNativeHomeHeaderActions(): {
  actionLayout: INativeHomeHeaderViewModel['actionLayout'];
  actionSubtitle: string;
  actions: INativeHomeHeaderActionViewModel[];
  handlers: IHeaderActionHandlers;
} {
  const intl = useIntl();
  const balanceState = useOwnerScopedHomeBalanceState();
  const reviewControlVisible = useReviewControl();
  const { config, getActionCustomization } = useWalletActionConfig();
  const send = useWalletActionSend({
    customization: getActionCustomization('send'),
  });
  const receive = useWalletActionReceive({
    customization: getActionCustomization('receive'),
    useSelector: true,
    variant: balanceState === 'zero' ? 'home_add_money' : 'home_full_row',
  });
  const buy = useWalletActionBuyMain({
    customization: getActionCustomization('buy'),
  });
  const swap = useWalletActionSwap({
    customization: getActionCustomization('swap'),
  });
  const perp = useWalletActionPerp({
    customization: getActionCustomization('perp'),
  });
  const staking = useWalletActionStaking({
    customization: getActionCustomization('staking'),
  });
  const more = useWalletActionMore();

  const toggleBalanceVisibility = useCallback(async () => {
    const current = await settingsValuePersistAtom.get();
    await settingsValuePersistAtom.set({ hideValue: !current.hideValue });
  }, []);

  const handlers = useMemo<IHeaderActionHandlers>(
    () => ({
      addMoney: receive.onPress,
      buy: buy.onPress,
      more: more.onPress,
      perp: perp.onPress,
      receive: receive.onPress,
      send: send.onPress,
      staking: staking.onPress,
      swap: swap.onPress,
      toggleBalanceVisibility,
    }),
    [
      buy.onPress,
      more.onPress,
      perp.onPress,
      receive.onPress,
      send.onPress,
      staking.onPress,
      swap.onPress,
      toggleBalanceVisibility,
    ],
  );

  const actions = useMemo<INativeHomeHeaderActionViewModel[]>(() => {
    if (balanceState === 'unknown') return [];
    if (balanceState === 'zero') {
      return [
        {
          id: 'addMoney',
          title: intl.formatMessage({ id: ETranslations.global_add_money }),
          icon: 'add',
          enabled: !receive.disabled || receive.allowPressWhenDisabled,
        },
        {
          id: 'more',
          title: intl.formatMessage({ id: ETranslations.global_more }),
          icon: 'more',
          enabled: true,
        },
      ];
    }

    const actionMap: Partial<
      Record<IWalletActionType, INativeHomeHeaderActionViewModel>
    > = {
      send: {
        id: 'send',
        title:
          send.label ?? intl.formatMessage({ id: ETranslations.global_send }),
        icon: 'send',
        enabled: !send.disabled,
      },
      receive: {
        id: 'receive',
        title:
          receive.label ??
          intl.formatMessage({ id: ETranslations.global_receive }),
        icon: 'receive',
        enabled: !receive.disabled || receive.allowPressWhenDisabled,
      },
      buy: {
        id: 'buy',
        title:
          buy.label ?? intl.formatMessage({ id: ETranslations.buy_and_sell }),
        icon: 'buy',
        enabled:
          reviewControlVisible &&
          (!buy.disabled || !!buy.allowPressWhenDisabled),
      },
      swap: {
        id: 'swap',
        title: swap.label,
        icon: 'swap',
        enabled: !swap.disabled,
      },
      perp: {
        id: 'perp',
        title: perp.label,
        icon: 'perp',
        enabled: !perp.disabled,
      },
      staking: {
        id: 'staking',
        title:
          staking.label ??
          intl.formatMessage({ id: ETranslations.global_earn }),
        icon: 'staking',
        enabled: !staking.disabled,
      },
    };
    const mainActions = config.mainActions
      .map((actionId) => actionMap[actionId])
      .filter((action): action is INativeHomeHeaderActionViewModel => !!action);
    return [
      ...mainActions,
      {
        id: 'more',
        title: intl.formatMessage({ id: ETranslations.global_more }),
        icon: 'more',
        enabled: true,
      },
    ];
  }, [
    balanceState,
    buy.allowPressWhenDisabled,
    buy.disabled,
    buy.label,
    config.mainActions,
    intl,
    perp.disabled,
    perp.label,
    receive.allowPressWhenDisabled,
    receive.disabled,
    receive.label,
    reviewControlVisible,
    send.disabled,
    send.label,
    staking.disabled,
    staking.label,
    swap.disabled,
    swap.label,
  ]);

  let actionLayout: INativeHomeHeaderViewModel['actionLayout'] = 'funded';
  if (balanceState === 'unknown') {
    actionLayout = 'loading';
  } else if (balanceState === 'zero') {
    actionLayout = 'zero';
  }

  return {
    actionLayout,
    actionSubtitle:
      balanceState === 'zero'
        ? intl.formatMessage({
            id: ETranslations.add_money_to_get_started,
          })
        : '',
    actions,
    handlers,
  };
}

function NativeHomeContent({
  sceneName,
}: {
  sceneName: EAccountSelectorSceneName;
}) {
  const colorScheme = useColorScheme();
  const owner = useNativeHomeOwnerToken(sceneName);
  const balance = useNativeHomeHeaderBalance();
  const headerActions = useNativeHomeHeaderActions();
  const viewModelRef = useRef<INativeHomeViewModel | null>(null);
  const actionHandlersRef = useRef<IHeaderActionHandlers>({});

  const state = useMemo<INativeHomeViewModel>(() => {
    return {
      protocolVersion: 1,
      owner,
      selectedTab: 'portfolio',
      header: {
        ...balance,
        balanceActionId: 'toggleBalanceVisibility',
        actionLayout: headerActions.actionLayout,
        actionSubtitle: headerActions.actionSubtitle,
        actions: headerActions.actions,
      },
      tabs: [
        {
          id: 'portfolio',
          title: 'Portfolio',
          enabled: true,
        },
      ],
      portfolio: {
        isDiagnostic: true,
        title: 'Portfolio migration is next',
        message:
          'Header data and actions are native. Portfolio remains a non-interactive Slice 2 shell.',
      },
      theme:
        colorScheme === 'dark'
          ? {
              colorScheme: 'dark',
              backgroundColor: '#0F0F0F',
              surfaceColor: '#FFFFFF12',
              primaryTextColor: '#FFFFFFED',
              secondaryTextColor: '#FFFFFFAF',
              disabledTextColor: '#FFFFFF64',
              accentColor: '#FFFFFFED',
            }
          : {
              colorScheme: 'light',
              backgroundColor: '#FFFFFF',
              surfaceColor: '#0000000F',
              primaryTextColor: '#000000DF',
              secondaryTextColor: '#0000009B',
              disabledTextColor: '#00000072',
              accentColor: '#000000DF',
            },
    };
  }, [
    balance,
    colorScheme,
    headerActions.actionLayout,
    headerActions.actionSubtitle,
    headerActions.actions,
    owner,
  ]);
  viewModelRef.current = state;
  actionHandlersRef.current = headerActions.handlers;

  const handleIntent = useCallback((intent: INativeHomeIntent) => {
    const currentViewModel = viewModelRef.current;
    if (!isNativeHomeIntentExecutable({ intent, viewModel: currentViewModel }))
      return;

    const handler = actionHandlersRef.current[intent.actionId];
    if (handler) void handler();
  }, []);

  return (
    <HomeContainer
      style={styles.container}
      state={state}
      onIntent={handleIntent}
    />
  );
}

export function NativeHomeDiagnosticPage({
  sceneName,
}: {
  sceneName: EAccountSelectorSceneName;
}) {
  const {
    activeAccount: { account },
  } = useActiveAccount({ num: 0 });
  return (
    <HomeTokenListProviderMirrorWrapper accountId={account?.id ?? ''}>
      <NativeHomeContent sceneName={sceneName} />
    </HomeTokenListProviderMirrorWrapper>
  );
}
