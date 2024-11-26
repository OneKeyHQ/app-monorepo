import {
  createContext,
  memo,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { cloneDeep } from 'lodash';
import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import {
  Accordion,
  Alert,
  Dialog,
  Icon,
  Page,
  SizableText,
  Skeleton,
  Switch,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountAvatar } from '@onekeyhq/kit/src/components/AccountAvatar';
import type { IWalletAvatarProps } from '@onekeyhq/kit/src/components/WalletAvatar';
import { WalletAvatar } from '@onekeyhq/kit/src/components/WalletAvatar';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import type {
  IDBAccount,
  IDBIndexedAccount,
  IDBWallet,
} from '@onekeyhq/kit-bg/src/dbs/local/types';
import {
  type IAccountActivityNotificationSettings,
  NOTIFICATION_ACCOUNT_ACTIVITY_DEFAULT_ENABLED,
  NOTIFICATION_ACCOUNT_ACTIVITY_DEFAULT_MAX_ACCOUNT_COUNT,
} from '@onekeyhq/kit-bg/src/dbs/simple/entity/SimpleDbEntityNotificationSettings';
import { useNotificationsAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/notifications';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import { EmptyNoWalletView } from '../../../AccountManagerStacks/pages/AccountSelectorStack/WalletDetails/EmptyView';

import type { GestureResponderEvent } from 'react-native';

type IDBWalletExtended = Omit<
  IDBWallet,
  'accounts' | 'backuped' | 'type' | 'nextIds' | 'walletNo' | 'hiddenWallets'
> & {
  img: IWalletAvatarProps['img'];
  enabled: boolean;
  accounts: {
    address: string;
    name: string;
    enabled: boolean;
  }[];
  hiddenWallets?: IDBWalletExtended[];
};

type IAccountNotificationSettingsContextType = {
  settings: IAccountActivityNotificationSettings | undefined;
  saveSettings: (
    buildSettings: (
      prevSettings: IAccountActivityNotificationSettings | undefined,
    ) => IAccountActivityNotificationSettings | undefined,
  ) => void;
  commitSettings: () => Promise<void>;
  totalEnabledAccountsCount: number;
  maxAccountCount: number;
};

const AccountNotificationSettingsContext = createContext<
  IAccountNotificationSettingsContextType | undefined
>(undefined);

function isWalletEnabledFn({
  settings,
  wallet,
}: {
  settings: IAccountActivityNotificationSettings | undefined;
  wallet: IDBWallet;
}) {
  return (
    settings?.[wallet.id]?.enabled ??
    NOTIFICATION_ACCOUNT_ACTIVITY_DEFAULT_ENABLED
  );
}

function isAccountEnabledFn({
  settings,
  account,
  wallet,
}: {
  settings: IAccountActivityNotificationSettings | undefined;
  account: IDBAccount | IDBIndexedAccount;
  wallet: IDBWallet;
}) {
  return (
    isWalletEnabledFn({
      settings,
      wallet,
    }) &&
    (settings?.[wallet.id]?.accounts?.[account.id]?.enabled ??
      NOTIFICATION_ACCOUNT_ACTIVITY_DEFAULT_ENABLED)
  );
}

function AccountNotificationSettingsProvider({
  children,
  wallets,
}: {
  children: React.ReactNode;
  wallets: IDBWallet[];
}) {
  const [settings, setSettings] = useState<
    IAccountActivityNotificationSettings | undefined
  >();

  const [
    {
      maxAccountCount = NOTIFICATION_ACCOUNT_ACTIVITY_DEFAULT_MAX_ACCOUNT_COUNT,
    },
  ] = useNotificationsAtom();

  const saveSettings = useCallback(
    (
      buildSettings: (
        prevSettings: IAccountActivityNotificationSettings | undefined,
      ) => IAccountActivityNotificationSettings | undefined,
    ) => {
      setSettings((v) => {
        const s = buildSettings(v);
        void backgroundApiProxy.serviceNotification.saveAccountActivityNotificationSettings(
          s,
        );
        return s;
      });
    },
    [],
  );

  const commitSettings = useCallback(async () => {
    if (settings) {
      await backgroundApiProxy.serviceNotification.saveAccountActivityNotificationSettings(
        settings,
      );
    }
  }, [settings]);

  const calculateEnabledAccountsCount = useCallback(
    (wallet: IDBWallet) =>
      (wallet?.dbAccounts ?? wallet?.dbIndexedAccounts ?? [])?.reduce(
        (acc, account) => {
          if (isAccountEnabledFn({ settings, account, wallet })) {
            return acc + 1;
          }
          return acc;
        },
        0,
      ),
    [settings],
  );

  const totalEnabledAccountsCount = useMemo(() => {
    let count = 0;
    wallets.forEach((wallet) => {
      count += calculateEnabledAccountsCount(wallet);
      if (wallet.hiddenWallets?.length) {
        wallet.hiddenWallets.forEach((hiddenWallet) => {
          count += calculateEnabledAccountsCount(hiddenWallet);
        });
      }
    });
    return count;
  }, [wallets, calculateEnabledAccountsCount]);

  const value = useMemo(
    () => ({
      settings,
      saveSettings,
      commitSettings,
      totalEnabledAccountsCount,
      maxAccountCount,
    }),
    [
      settings,
      saveSettings,
      commitSettings,
      totalEnabledAccountsCount,
      maxAccountCount,
    ],
  );

  useEffect(() => {
    void (async () => {
      const savedSettings =
        await backgroundApiProxy.simpleDb.notificationSettings.getRawData();
      if (savedSettings) {
        setSettings(savedSettings.accountActivity);
      }
    })();
  }, []);

  return (
    <AccountNotificationSettingsContext.Provider value={value}>
      {children}
    </AccountNotificationSettingsContext.Provider>
  );
}

function useContextAccountNotificationSettings() {
  const context = useContext(AccountNotificationSettingsContext);
  if (context === undefined) {
    throw new Error(
      'useAccountNotificationSettings must be used within a NotificationSettingsProvider',
    );
  }
  return context;
}

function formatSavedEnabledValue(value: boolean) {
  return value;
  // return value === NOTIFICATION_ACCOUNT_ACTIVITY_DEFAULT_ENABLED
  //   ? undefined
  // : value;
}

function AccountAccordionItem({
  account,
  isAccountEnabled,
  isOthersWallet,
  toggleAccountSwitch,
}: {
  account: IDBAccount | IDBIndexedAccount;
  isAccountEnabled: boolean;
  isOthersWallet: boolean;
  toggleAccountSwitch: (
    value: boolean,
    dbAccount: IDBAccount | IDBIndexedAccount,
  ) => void;
}) {
  console.log('render AccountAccordionItem', account.name);
  return (
    <XStack
      key={account.id}
      gap="$3"
      alignItems="center"
      pl={56}
      pr="$5"
      py="$2"
    >
      <AccountAvatar
        dbAccount={isOthersWallet ? (account as IDBAccount) : undefined}
        indexedAccount={
          isOthersWallet ? undefined : (account as IDBIndexedAccount)
        }
      />
      <SizableText flex={1} size="$bodyLgMedium">
        {account.name}
      </SizableText>
      <Switch
        size="small"
        value={isAccountEnabled}
        onChange={(value) => toggleAccountSwitch(value, account)}
      />
    </XStack>
  );
}

const AccountAccordionItemMemo = memo(AccountAccordionItem);

function AccountAccordionItemContainer({
  account,
  wallet,
  isOthersWallet,
}: {
  account: IDBAccount | IDBIndexedAccount;
  wallet: IDBWallet;
  isOthersWallet: boolean;
}) {
  const intl = useIntl();
  const {
    settings: accountNotificationSettings,
    saveSettings: saveAccountNotificationSettings,
    totalEnabledAccountsCount,
    maxAccountCount,
  } = useContextAccountNotificationSettings();

  const totalEnabledAccountsCountRef = useRef(totalEnabledAccountsCount);
  totalEnabledAccountsCountRef.current = totalEnabledAccountsCount;

  const isAccountEnabled = useMemo(
    () =>
      isAccountEnabledFn({
        settings: accountNotificationSettings,
        account,
        wallet,
      }),
    [accountNotificationSettings, account, wallet],
  );

  const toggleAccountSwitch = useCallback(
    (value: boolean, dbAccount: IDBAccount | IDBIndexedAccount) => {
      saveAccountNotificationSettings((prevSettings) => {
        const newSettings = cloneDeep({ ...(prevSettings ?? {}) });
        const newValue = value;

        if (newValue) {
          if (totalEnabledAccountsCountRef.current >= maxAccountCount) {
            Dialog.confirm({
              title: intl.formatMessage({
                id: ETranslations.notifications_account_reached_limit_dialog_title,
              }),
              description: intl.formatMessage(
                {
                  id: ETranslations.notifications_account_reached_limit_dialog_desc,
                },
                {
                  maxAccountCount,
                },
              ),
              onConfirmText: intl.formatMessage({
                id: ETranslations.global_got_it,
              }),
            });
            return newSettings;
          }
        }

        newSettings[wallet.id] = {
          ...newSettings?.[wallet.id],
          accounts: {
            ...newSettings?.[wallet.id]?.accounts,
            [dbAccount.id]: {
              enabled: formatSavedEnabledValue(newValue),
            },
          },
        };
        return newSettings;
      });
    },
    [intl, maxAccountCount, saveAccountNotificationSettings, wallet.id],
  );

  return (
    <AccountAccordionItemMemo
      account={account}
      isAccountEnabled={isAccountEnabled}
      isOthersWallet={isOthersWallet}
      toggleAccountSwitch={toggleAccountSwitch}
    />
  );
}

function WalletAccordionItem({
  wallet,
  isOthersWallet,
  isWalletEnabled,
  enabledAccountsCount,
  totalAccountsCount,
  toggleWalletSwitch,
}: {
  wallet: IDBWallet;
  isOthersWallet: boolean;
  isWalletEnabled: boolean;
  enabledAccountsCount: number;
  totalAccountsCount: number;
  toggleWalletSwitch: (value: boolean) => void;
}) {
  if (totalAccountsCount === 1) {
    // debugger;
  }
  console.log('render WalletAccordionItem', wallet.name, {
    wallet,
    isOthersWallet,
    isWalletEnabled,
    enabledAccountsCount,
    totalAccountsCount,
    toggleWalletSwitch,
  });
  // prevent event bubbling
  const stopPropagation = useCallback((event: GestureResponderEvent) => {
    event.stopPropagation();
  }, []);

  return (
    <Accordion.Item
      // collapse when wallet is disabled
      value={isWalletEnabled ? wallet.id : 'mockClosedItemValue'}
      // bg="$bgApp"
    >
      <Accordion.Trigger
        unstyled
        flexDirection="row"
        alignItems="center"
        gap="$3"
        py="$2"
        px="$5"
        // bg="$transparent"
        bg="$bgApp"
        borderWidth={0}
        disabled={!isWalletEnabled}
        {...(isWalletEnabled && {
          hoverStyle: {
            bg: '$bgHover',
          },
          pressStyle: {
            bg: '$bgActive',
          },
          focusVisibleStyle: {
            outlineColor: '$focusRing',
            outlineWidth: 2,
            outlineStyle: 'solid',
            outlineOffset: 0,
          },
        })}
      >
        {({ open }: { open: boolean }) => (
          <>
            <XStack
              animation="quick"
              flex={1}
              alignItems="center"
              gap="$3"
              opacity={isWalletEnabled ? 1 : 0.5}
            >
              <YStack animation="quick" rotate={open ? '180deg' : '0deg'}>
                <Icon
                  name="ChevronBottomOutline"
                  color={open ? '$iconActive' : '$iconSubdued'}
                />
              </YStack>
              <WalletAvatar
                img={wallet.avatarInfo?.img}
                wallet={wallet as IDBWallet & Partial<IDBWalletExtended>}
              />
              <XStack gap="$1" flex={1}>
                <SizableText
                  size="$bodyLgMedium"
                  numberOfLines={1}
                  flexShrink={1}
                >
                  {wallet.name}
                </SizableText>
                <SizableText>
                  ({enabledAccountsCount}/{totalAccountsCount})
                </SizableText>
              </XStack>
            </XStack>
            <Switch
              size="small"
              value={isWalletEnabled}
              onChange={toggleWalletSwitch}
              onPress={stopPropagation}
            />
          </>
        )}
      </Accordion.Trigger>

      <Accordion.HeightAnimator animation="quick">
        <Accordion.Content
          unstyled
          // bg="$transparent"
          bg="$bgDefault"
          animation="quick"
          exitStyle={{
            opacity: 0,
          }}
        >
          {(wallet.dbAccounts ?? wallet.dbIndexedAccounts)?.map((account) => (
            <AccountAccordionItemContainer
              key={account.id}
              account={account}
              wallet={wallet}
              isOthersWallet={isOthersWallet}
            />
          ))}
        </Accordion.Content>
      </Accordion.HeightAnimator>
    </Accordion.Item>
  );
}

const WalletAccordionItemMemo = memo(WalletAccordionItem);

function WalletAccordionItemContainer({
  wallet,
  onWalletEnabledChange,
}: {
  wallet: IDBWallet;
  onWalletEnabledChange: (params: {
    wallet: IDBWallet;
    enabled: boolean;
  }) => void;
}) {
  const {
    settings: accountNotificationSettings,
    saveSettings: saveAccountNotificationSettings,
    totalEnabledAccountsCount,
    maxAccountCount,
  } = useContextAccountNotificationSettings();

  const totalEnabledAccountsCountRef = useRef(totalEnabledAccountsCount);
  totalEnabledAccountsCountRef.current = totalEnabledAccountsCount;

  const isWalletEnabled = useMemo(
    () =>
      isWalletEnabledFn({
        settings: accountNotificationSettings,
        wallet,
      }),
    [accountNotificationSettings, wallet],
  );
  const isOthersWallet = useMemo(
    () =>
      accountUtils.isOthersWallet({
        walletId: wallet.id,
      }),
    [wallet.id],
  );

  // handle switch change
  const toggleWalletSwitch = useCallback(
    (value: boolean) => {
      saveAccountNotificationSettings((prevSettings) => {
        const newSettings = cloneDeep({ ...(prevSettings ?? {}) });
        const newValue = value;

        if (newValue && newSettings?.[wallet.id]?.accounts) {
          let enabledAccountsCount = 0;
          Object.values(newSettings?.[wallet.id]?.accounts || {}).forEach(
            (item) => {
              if (item.enabled) {
                enabledAccountsCount += 1;
                if (
                  totalEnabledAccountsCountRef.current + enabledAccountsCount >
                  maxAccountCount
                ) {
                  item.enabled = false;
                }
              }
            },
          );
        }

        newSettings[wallet.id] = {
          ...newSettings?.[wallet.id],
          enabled: formatSavedEnabledValue(newValue),
        };
        onWalletEnabledChange({
          wallet,
          enabled: newValue,
        });
        return newSettings;
      });
    },
    [
      maxAccountCount,
      onWalletEnabledChange,
      saveAccountNotificationSettings,
      wallet,
    ],
  );

  const totalAccountsCount = useMemo(() => {
    const result = (wallet.dbAccounts ?? wallet.dbIndexedAccounts)?.length ?? 0;

    return result;
  }, [wallet.dbAccounts, wallet.dbIndexedAccounts]);

  const enabledAccountsCount = useMemo(() => {
    if (!isWalletEnabled) {
      return 0;
    }
    return Object.values(
      accountNotificationSettings?.[wallet.id]?.accounts ?? {},
    ).filter((account) => account.enabled === true).length;
    // return (
    //   totalAccountsCount -
    //   Object.values(
    //     accountNotificationSettings?.[wallet.id]?.accounts ?? {},
    //   ).filter((account) => account.enabled === false).length
    // );
  }, [isWalletEnabled, accountNotificationSettings, wallet.id]);

  return (
    <WalletAccordionItemMemo
      wallet={wallet}
      isOthersWallet={isOthersWallet}
      isWalletEnabled={isWalletEnabled}
      enabledAccountsCount={enabledAccountsCount}
      totalAccountsCount={totalAccountsCount}
      toggleWalletSwitch={toggleWalletSwitch}
    />
  );
}

function LoadingView({ show }: { show: boolean }) {
  return (
    <Skeleton.Group show={show}>
      {Array.from({ length: 3 }).map((_, index) => (
        <XStack key={index} alignItems="center" px="$5" py="$2">
          <XStack alignItems="center" gap="$3" flex={1}>
            <Icon name="ChevronBottomOutline" color="$neutral4" />
            <Skeleton w="$10" h="$10" radius={8} />
            <Skeleton.BodyLg />
          </XStack>
          <Switch size="small" disabled />
        </XStack>
      ))}
    </Skeleton.Group>
  );
}

function getDefaultExpandWalletId({
  wallets,
  settings,
}: {
  wallets: IDBWallet[];
  settings: IAccountActivityNotificationSettings;
}) {
  for (const wallet of wallets) {
    if (settings[wallet.id]?.enabled) {
      return wallet.id;
    }
    for (const hiddenWallet of wallet.hiddenWallets || []) {
      if (settings[hiddenWallet.id]?.enabled) {
        return hiddenWallet.id;
      }
    }
  }
  return wallets?.[0]?.id;
}

function WalletAccordionList({
  defaultExpandWalletId,
  wallets,
}: {
  defaultExpandWalletId: string | undefined;
  wallets: IDBWallet[];
}) {
  const [expandValue, setExpandValue] = useState(defaultExpandWalletId);

  const onWalletEnabledChange = useCallback(
    (params: { wallet: IDBWallet; enabled: boolean }) => {
      if (params.enabled) {
        setExpandValue(params.wallet.id);
      }
    },
    [],
  );

  if (!wallets || !wallets?.length) {
    return <EmptyNoWalletView />;
  }

  return (
    <Accordion
      type="single"
      collapsible
      value={expandValue}
      onValueChange={setExpandValue}
    >
      {wallets.map((wallet, index) => (
        <YStack
          key={wallet.id}
          {...(index !== 0 && {
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: '$borderSubdued',
          })}
        >
          <WalletAccordionItemContainer
            wallet={wallet}
            onWalletEnabledChange={onWalletEnabledChange}
          />
          {/* render items for */}
          {wallet.hiddenWallets?.map((hiddenWallet) => (
            <WalletAccordionItemContainer
              key={hiddenWallet.id}
              wallet={hiddenWallet}
              onWalletEnabledChange={onWalletEnabledChange}
            />
          ))}
        </YStack>
      ))}
    </Accordion>
  );
}

const WalletAccordionListMemo = memo(WalletAccordionList);

function ManageAccountActivityContent({ wallets }: { wallets: IDBWallet[] }) {
  const intl = useIntl();
  const {
    totalEnabledAccountsCount,
    maxAccountCount,
    settings: accountNotificationSettings,
  } = useContextAccountNotificationSettings();
  const shouldShowAlert = useMemo(
    () => totalEnabledAccountsCount / maxAccountCount >= 0.9,
    [totalEnabledAccountsCount, maxAccountCount],
  );

  const defaultExpandWalletIdRef = useRef<string | undefined>();
  if (!defaultExpandWalletIdRef.current && accountNotificationSettings) {
    defaultExpandWalletIdRef.current = getDefaultExpandWalletId({
      wallets,
      settings: accountNotificationSettings,
    });
  }

  return (
    <>
      {shouldShowAlert ? (
        <Alert
          mx="$5"
          mb="$2"
          type="warning"
          // title={`${totalEnabledAccountsCount}/${maxAccountCount} accounts enabled`}
          title={intl.formatMessage(
            {
              id: ETranslations.notifications_account_activity_manage_count_alert_title,
            },
            {
              totalEnabledAccountsCount,
              maxAccountCount,
            },
          )}
          closable={false}
        />
      ) : null}
      {accountNotificationSettings ? (
        <WalletAccordionListMemo
          wallets={wallets}
          defaultExpandWalletId={defaultExpandWalletIdRef.current}
        />
      ) : null}
    </>
  );
}

function ManageAccountActivity() {
  const intl = useIntl();

  const { result: { wallets } = { wallets: [] }, isLoading } = usePromiseResult(
    () =>
      backgroundApiProxy.serviceNotification.getNotificationWalletsAndAccounts(),
    [],
    {
      watchLoading: true,
    },
  );

  return (
    <Page scrollEnabled>
      <Page.Header
        title={intl.formatMessage({ id: ETranslations.global_manage })}
      />
      <Page.Body>
        <AccountNotificationSettingsProvider wallets={wallets}>
          {isLoading ? (
            <LoadingView show={isLoading} />
          ) : (
            <ManageAccountActivityContent wallets={wallets} />
          )}
        </AccountNotificationSettingsProvider>
      </Page.Body>
    </Page>
  );
}

function ManageAccountActivityPage() {
  useEffect(
    () => () => {
      void backgroundApiProxy.serviceNotification.registerClientWithOverrideAllAccounts();
    },
    [],
  );
  return useMemo(() => <ManageAccountActivity />, []);
}

export default ManageAccountActivityPage;
