import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import {
  Accordion,
  Icon,
  Page,
  SizableText,
  Skeleton,
  Switch,
  Toast,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountAvatar } from '@onekeyhq/kit/src/components/AccountAvatar';
import type { IWalletAvatarProps } from '@onekeyhq/kit/src/components/WalletAvatar';
import { WalletAvatar } from '@onekeyhq/kit/src/components/WalletAvatar';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import type {
  IDBAccount,
  IDBIndexedAccount,
  IDBWallet,
} from '@onekeyhq/kit-bg/src/dbs/local/types';
import {
  type IAccountActivityNotificationSettings,
  NOTIFICATION_ACCOUNT_ACTIVITY_DEFAULT_ENABLED,
} from '@onekeyhq/kit-bg/src/dbs/simple/entity/SimpleDbEntityNotificationSettings';
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
};

const AccountNotificationSettingsContext = createContext<
  IAccountNotificationSettingsContextType | undefined
>(undefined);

function AccountNotificationSettingsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [settings, setSettings] = useState<
    IAccountActivityNotificationSettings | undefined
  >();

  const saveSettings = useCallback(
    (
      buildSettings: (
        prevSettings: IAccountActivityNotificationSettings | undefined,
      ) => IAccountActivityNotificationSettings | undefined,
    ) => {
      setSettings((v) => buildSettings(v));
    },
    [],
  );

  const commitSettings = useCallback(async () => {
    if (settings) {
      await backgroundApiProxy.simpleDb.notificationSettings.saveAccountActivityNotificationSettings(
        settings,
      );
    }
  }, [settings]);

  const value = useMemo(
    () => ({
      settings,
      saveSettings,
      commitSettings,
    }),
    [settings, saveSettings, commitSettings],
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

function useAccountNotificationSettings() {
  const context = useContext(AccountNotificationSettingsContext);
  if (context === undefined) {
    throw new Error(
      'useAccountNotificationSettings must be used within a NotificationSettingsProvider',
    );
  }
  return context;
}

function formatSavedEnabledValue(value: boolean) {
  return value === NOTIFICATION_ACCOUNT_ACTIVITY_DEFAULT_ENABLED
    ? undefined
    : value;
}

function AccordionItem({
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
  } = useAccountNotificationSettings();

  const isWalletEnabled =
    accountNotificationSettings?.[wallet.id]?.enabled ??
    NOTIFICATION_ACCOUNT_ACTIVITY_DEFAULT_ENABLED;
  const isOthersWallet = useMemo(
    () =>
      accountUtils.isOthersWallet({
        walletId: wallet.id,
      }),
    [wallet.id],
  );

  // prevent event bubbling
  const stopPropagation = (event: GestureResponderEvent) => {
    event.stopPropagation();
  };

  // handle switch change
  const toggleWalletSwitch = (value: boolean) => {
    saveAccountNotificationSettings((prevSettings) => {
      const newSettings = { ...(prevSettings ?? {}) };
      const newValue = value;
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
  };

  const toggleAccountSwitch = (
    value: boolean,
    account: IDBAccount | IDBIndexedAccount,
  ) => {
    saveAccountNotificationSettings((prevSettings) => {
      const newSettings = { ...(prevSettings ?? {}) };
      const newValue = value;
      newSettings[wallet.id] = {
        ...newSettings?.[wallet.id],
        accounts: {
          ...newSettings?.[wallet.id]?.accounts,
          [account.id]: {
            enabled: formatSavedEnabledValue(newValue),
          },
        },
      };
      return newSettings;
    });
  };

  const totalAccountsCount =
    (wallet.dbAccounts ?? wallet.dbIndexedAccounts)?.length ?? 0;
  const enabledAccountsCount = useMemo(() => {
    if (!isWalletEnabled) {
      return 0;
    }
    return (
      totalAccountsCount -
      Object.values(
        accountNotificationSettings?.[wallet.id]?.accounts ?? {},
      ).filter((account) => account.enabled === false).length
    );
  }, [
    isWalletEnabled,
    totalAccountsCount,
    accountNotificationSettings,
    wallet.id,
  ]);

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
                value={
                  accountNotificationSettings?.[wallet.id]?.accounts?.[
                    account.id
                  ]?.enabled ?? NOTIFICATION_ACCOUNT_ACTIVITY_DEFAULT_ENABLED
                }
                onChange={(value) => toggleAccountSwitch(value, account)}
              />
            </XStack>
          ))}
        </Accordion.Content>
      </Accordion.HeightAnimator>
    </Accordion.Item>
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
          <Switch disabled />
        </XStack>
      ))}
    </Skeleton.Group>
  );
}

function WalletAccordionList({ wallets }: { wallets: IDBWallet[] }) {
  const [expandValue, setExpandValue] = useState(wallets?.[0]?.id);

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
          <AccordionItem
            wallet={wallet}
            onWalletEnabledChange={onWalletEnabledChange}
          />
          {/* render items for */}
          {wallet.hiddenWallets?.map((hiddenWallet) => (
            <AccordionItem
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

function ManageAccountActivity() {
  const intl = useIntl();
  const navigation = useAppNavigation();

  const [isSaving, setIsSaving] = useState(false);
  const { result: { wallets } = { wallets: [] }, isLoading } = usePromiseResult(
    () =>
      backgroundApiProxy.serviceAccount.getWallets({
        nestedHiddenWallets: true,
        ignoreEmptySingletonWalletAccounts: true,
        includingAccounts: true,
      }),
    [],
    {
      watchLoading: true,
    },
  );

  const { commitSettings } = useAccountNotificationSettings();

  const onSave = useCallback(async () => {
    try {
      setIsSaving(true);
      await commitSettings();
      await backgroundApiProxy.serviceNotification.registerClientWithOverrideAllAccountsImmediate();
      void navigation.popStack();
    } catch (error) {
      Toast.error({
        title: intl.formatMessage({ id: ETranslations.global_update_failed }),
      });
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  }, [commitSettings, intl, navigation]);

  return (
    <Page scrollEnabled>
      <Page.Header
        title={intl.formatMessage({ id: ETranslations.global_manage })}
      />
      <Page.Body>
        {isLoading ? (
          <LoadingView show={isLoading} />
        ) : (
          <WalletAccordionList wallets={wallets} />
        )}
      </Page.Body>
      <Page.Footer
        onConfirmText={intl.formatMessage({
          id: ETranslations.action_save,
        })}
        confirmButtonProps={{
          disabled: false,
          loading: isSaving,
        }}
        onConfirm={onSave}
      />
    </Page>
  );
}

function ManageAccountActivityPage() {
  return useMemo(
    () => (
      <AccountNotificationSettingsProvider>
        <ManageAccountActivity />
      </AccountNotificationSettingsProvider>
    ),
    [],
  );
}

export default ManageAccountActivityPage;
