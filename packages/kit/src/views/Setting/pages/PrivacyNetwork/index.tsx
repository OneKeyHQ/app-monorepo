import { useCallback, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Dialog,
  Divider,
  ESwitchSize,
  Page,
  ScrollView,
  SizableText,
  Spinner,
  Stack,
  Switch,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { LazyLoadPage } from '@onekeyhq/kit/src/components/LazyLoadPage';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useRouteIsFocused } from '@onekeyhq/kit/src/hooks/useRouteIsFocused';
import { AccountManagerTestIDs } from '@onekeyhq/kit/src/views/AccountManagerStacks/testIDs';
import {
  BirthdayDialogForm,
  type IBirthdayFormState,
} from '@onekeyhq/kit/src/views/AssetDetails/pages/TokenDetails/LocalWalletRepairControls';
import { useDevSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import { EAccountManagerStacksRoutes } from '@onekeyhq/shared/src/routes/accountManagerStacks';
import type {
  EModalSettingRoutes,
  IModalSettingParamList,
} from '@onekeyhq/shared/src/routes/setting';
import { isUnresolvedPrivacyChainBroadcastError } from '@onekeyhq/shared/src/utils/privacyChainDisplayUtils';

import type { RouteProp } from '@react-navigation/core';

const ZcashDebugSettings = LazyLoadPage(
  async () => {
    const { ZcashDebugSettings: Component } =
      await import('@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/ZcashWasmGallery');
    return { default: Component };
  },
  undefined,
  true,
);

type IPrivacyAccountEntry = {
  accountId: string;
  accountName: string;
  walletName: string;
  networkId: string;
  enabled: boolean;
  operation?: 'enable' | 'disable';
  preferPublicSends: boolean;
  birthdayHintTimestamp?: number;
};

// Lists every HD account on a local-wallet network (optionally one wallet or
// one network) with its opt-in switch and send preference. Everything goes
// through servicePrivacyChain; nothing here knows which chain it is.
export default function PrivacyNetworkSettings({
  walletId: walletIdProp,
}: {
  walletId?: string;
}) {
  const route =
    useRoute<
      RouteProp<
        IModalSettingParamList,
        EModalSettingRoutes.SettingPrivacyNetwork
      >
    >();
  const walletId = walletIdProp ?? route.params?.walletId;
  const networkIdFilter = route.params?.networkId;
  const intl = useIntl();
  const navigation = useAppNavigation();
  const isFocused = useRouteIsFocused();
  const [devSettings] = useDevSettingsPersistAtom();
  const [busyAccountId, setBusyAccountId] = useState<string | undefined>();

  const { result: title } = usePromiseResult(async () => {
    if (!networkIdFilter) return undefined;
    const network = await backgroundApiProxy.serviceNetwork.getNetworkSafe({
      networkId: networkIdFilter,
    });
    return network?.name;
  }, [networkIdFilter]);

  const { result: entries, run: refreshEntries } =
    usePromiseResult(async (): Promise<IPrivacyAccountEntry[] | undefined> => {
      if (!isFocused) return undefined;
      const accounts =
        await backgroundApiProxy.servicePrivacyChain.listLocalWalletAccounts({
          walletId,
        });
      return Promise.all(
        accounts
          .filter(
            (account) =>
              !networkIdFilter || account.networkId === networkIdFilter,
          )
          .map(async (account) => {
            const state =
              await backgroundApiProxy.servicePrivacyChain.getLocalWalletAccountState(
                {
                  networkId: account.networkId,
                  accountId: account.accountId,
                },
              );
            return {
              accountId: account.accountId,
              accountName: account.accountName,
              walletName: account.walletName,
              networkId: account.networkId,
              enabled: state.enabled,
              operation: state.pendingOperation,
              preferPublicSends: state.preferPublicSends,
              birthdayHintTimestamp: state.birthdayHintTimestamp,
            };
          }),
      );
    }, [isFocused, walletId, networkIdFilter]);

  const { result: allowCellularSync, run: refreshAllowCellularSync } =
    usePromiseResult(
      () =>
        backgroundApiProxy.servicePrivacyChain.getAllowPrivacySyncOnCellular(),
      [],
    );

  const showUnresolvedBroadcastDialog = useCallback(() => {
    Dialog.confirm({
      title: intl.formatMessage({ id: ETranslations.global_retry }),
      description: intl.formatMessage({
        id: ETranslations.global_an_error_occurred_desc,
      }),
      onConfirmText: intl.formatMessage({ id: ETranslations.global_refresh }),
      onConfirm: () => {
        void refreshEntries();
      },
    });
  }, [intl, refreshEntries]);

  const enableAccount = useCallback(
    (entry: IPrivacyAccountEntry) => {
      const formRef: { current: IBirthdayFormState } = {
        current: {
          mode: 'month',
          month:
            typeof entry.birthdayHintTimestamp === 'number'
              ? new Date(entry.birthdayHintTimestamp)
              : null,
          height: '',
        },
      };
      Dialog.confirm({
        title: entry.accountName,
        description: intl.formatMessage({
          id: ETranslations.trade_privacy_mode_tooltips,
        }),
        renderContent: <BirthdayDialogForm formRef={formRef} monthOnly />,
        onConfirmText: intl.formatMessage({ id: ETranslations.global_enable }),
        onConfirm: async ({ preventClose }) => {
          const { month } = formRef.current;
          if (!month) {
            preventClose();
            return;
          }
          setBusyAccountId(entry.accountId);
          try {
            await backgroundApiProxy.servicePrivacyChain.enableLocalWalletAccount(
              {
                networkId: entry.networkId,
                accountId: entry.accountId,
                birthdayTimestamp: new Date(
                  month.getFullYear(),
                  month.getMonth(),
                  1,
                ).getTime(),
              },
            );
            await refreshEntries();
          } finally {
            setBusyAccountId(undefined);
          }
        },
      });
    },
    [intl, refreshEntries],
  );

  const disableAccount = useCallback(
    async (entry: IPrivacyAccountEntry) => {
      setBusyAccountId(entry.accountId);
      try {
        await backgroundApiProxy.servicePrivacyChain.disableLocalWalletAccount({
          networkId: entry.networkId,
          accountId: entry.accountId,
        });
        await refreshEntries();
      } catch (error) {
        if (isUnresolvedPrivacyChainBroadcastError(error)) {
          showUnresolvedBroadcastDialog();
          return;
        }
        throw error;
      } finally {
        setBusyAccountId(undefined);
      }
    },
    [refreshEntries, showUnresolvedBroadcastDialog],
  );

  const setPreferTransparent = useCallback(
    async (entry: IPrivacyAccountEntry, enabled: boolean) => {
      setBusyAccountId(entry.accountId);
      try {
        await backgroundApiProxy.servicePrivacyChain.setLocalWalletAccountSendPreference(
          {
            networkId: entry.networkId,
            accountId: entry.accountId,
            preferPublic: enabled,
          },
        );
        await refreshEntries();
      } finally {
        setBusyAccountId(undefined);
      }
    },
    [refreshEntries],
  );

  const renderAccount = (entry: IPrivacyAccountEntry) => {
    const busy = busyAccountId !== undefined || !!entry.operation;
    let status = intl.formatMessage({
      id: entry.enabled
        ? ETranslations.global_enabled
        : ETranslations.global_disabled,
    });
    if (entry.operation) {
      status = intl.formatMessage({ id: ETranslations.global_processing });
    }
    return (
      <YStack key={entry.accountId}>
        <ListItem
          testID={AccountManagerTestIDs.privacyNetworkAccount(entry.accountId)}
          icon="ShieldOutline"
          title={entry.accountName}
          subtitle={[entry.walletName, status].filter(Boolean).join(' · ')}
          onPress={() => {
            navigation.pushModal(EModalRoutes.AccountManagerStacks, {
              screen: EAccountManagerStacksRoutes.PrivacyNetworkAccount,
              params: {
                accountId: entry.accountId,
                accountName: entry.accountName,
                networkId: entry.networkId,
              },
            });
          }}
        >
          <Switch
            testID={`privacy-network-switch-${entry.accountId}`}
            size={ESwitchSize.small}
            value={entry.enabled || entry.operation === 'enable'}
            disabled={busy}
            onChange={(next) => {
              if (next) {
                enableAccount(entry);
              } else {
                void disableAccount(entry);
              }
            }}
          />
        </ListItem>
        {entry.enabled ? (
          <ListItem
            pl="$16"
            title="Use transparent funds first"
            subtitle="For sends to shielded addresses, spend transparent funds before the selected shielded pool."
          >
            <Switch
              testID="privacy-network-prefer-public-switch"
              size={ESwitchSize.small}
              value={entry.preferPublicSends}
              disabled={busy}
              onChange={(next) => {
                void setPreferTransparent(entry, next);
              }}
            />
          </ListItem>
        ) : null}
      </YStack>
    );
  };

  return (
    <Page testID="settings-privacy-network-page">
      <Page.Header
        title={
          title ?? intl.formatMessage({ id: ETranslations.trade_privacy_mode })
        }
      />
      <Page.Body>
        {entries ? (
          <ScrollView>
            <Stack px="$5" pt="$4" pb="$2">
              <SizableText size="$bodySm" color="$textSubdued">
                Local scanning runs only for the accounts you turn on. Turning
                an account off pauses scanning and hides its shielded balance.
              </SizableText>
            </Stack>
            {entries.length === 0 ? (
              <Stack px="$5" py="$4" testID="settings-privacy-network-empty">
                <SizableText color="$textSubdued">
                  {intl.formatMessage({ id: ETranslations.no_account })}
                </SizableText>
              </Stack>
            ) : (
              entries.map(renderAccount)
            )}
            <Divider my="$2" />
            <ListItem title="Allow scanning on cellular data">
              <Switch
                testID="privacy-chain-cellular-sync-switch"
                size={ESwitchSize.small}
                value={allowCellularSync ?? false}
                disabled={allowCellularSync === undefined}
                onChange={async (allow) => {
                  await backgroundApiProxy.servicePrivacyChain.setAllowPrivacySyncOnCellular(
                    { allow },
                  );
                  void refreshAllowCellularSync();
                }}
              />
            </ListItem>
            {devSettings.enabled ? (
              <>
                <Divider my="$2" />
                <YStack px="$5" py="$4" testID="settings-privacy-network-debug">
                  <ZcashDebugSettings />
                </YStack>
              </>
            ) : null}
          </ScrollView>
        ) : (
          <Stack flex={1} alignItems="center" justifyContent="center">
            <Spinner />
          </Stack>
        )}
      </Page.Body>
    </Page>
  );
}
