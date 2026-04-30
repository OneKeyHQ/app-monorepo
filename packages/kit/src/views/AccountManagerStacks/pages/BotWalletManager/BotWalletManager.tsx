import { useCallback, useEffect, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Badge,
  Button,
  Dialog,
  Empty,
  Icon,
  IconButton,
  Input,
  Page,
  SectionList,
  SizableText,
  Spinner,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { showRenameDialog } from '@onekeyhq/kit/src/components/RenameDialog';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useAppRoute } from '@onekeyhq/kit/src/hooks/useAppRoute';
import {
  useAccountSelectorActions,
  useActiveAccount,
  useSelectedAccount,
} from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import {
  BOT_WALLET_STATUS_ACTIVE,
  BOT_WALLET_STATUS_DEACTIVATED,
} from '@onekeyhq/shared/src/consts/dbConsts';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import type {
  EAccountManagerStacksRoutes,
  IAccountManagerStacksParamList,
} from '@onekeyhq/shared/src/routes/accountManagerStacks';
import { EPrimePages } from '@onekeyhq/shared/src/routes/prime';
import {
  EChangeHistoryContentType,
  EChangeHistoryEntityType,
} from '@onekeyhq/shared/src/types/changeHistory';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import type { IBotWalletMetadata } from '@onekeyhq/shared/types/botWallet';

import {
  type IBotWalletEntry,
  type IBotWalletSection,
  buildBotWalletSections,
  formatBotWalletBadgeLabel,
  getBotWalletListItemActions,
  updateBotWalletEntryMetadata,
} from './botWalletManagerUtils';

function BotWalletListItem({
  entry,
  onRename,
  onVisibilityToggle,
  onDeactivate,
  onReactivate,
}: {
  entry: IBotWalletEntry;
  onRename: (params: { walletId: string; name: string }) => Promise<void>;
  onVisibilityToggle: (params: {
    walletId: string;
    walletName: string;
    visible: boolean;
  }) => Promise<void>;
  onDeactivate: (walletId: string) => Promise<void>;
  onReactivate: (walletId: string) => Promise<void>;
}) {
  const intl = useIntl();
  const { wallet, metadata } = entry;
  const navigation = useAppNavigation();
  const isDeactivated = metadata.status === BOT_WALLET_STATUS_DEACTIVATED;
  const visibleActions = getBotWalletListItemActions(metadata.status);
  const canExportMnemonic = visibleActions.includes('export-mnemonic');
  const canToggleVisibility = visibleActions.includes('visibility');
  const canDeactivate = visibleActions.includes('deactivate');
  const canReactivate = visibleActions.includes('reactivate');
  const visibilityIcon = metadata.visible ? 'EyeOutline' : 'EyeClosedOutline';
  const visibilityIconColor = metadata.visible ? '$icon' : '$iconDisabled';
  const visibilityAccessibilityLabel = metadata.visible
    ? '已显示到主界面，点击隐藏'
    : '未显示到主界面，点击显示';

  const handleVisibilityToggle = useCallback(
    async (val: boolean) => {
      await onVisibilityToggle({
        walletId: wallet.id,
        walletName: metadata.name,
        visible: val,
      });
    },
    [metadata.name, wallet.id, onVisibilityToggle],
  );

  const handleDeactivate = useCallback(() => {
    Dialog.confirm({
      title: '确认停用该 Bot 钱包？',
      description:
        '⚠️ 停用后，该钱包将不再提供收款功能。如果已将助记词导出至外部程序，建议尽快将资产转移至其他安全钱包。',
      onConfirmText: '确认停用',
      onConfirm: async () => {
        await onDeactivate(wallet.id);
      },
    });
  }, [wallet.id, onDeactivate]);

  const handleReactivate = useCallback(() => {
    Dialog.confirm({
      title: '确认重新激活？',
      description: '该钱包曾因安全原因被停用，确认重新启用？',
      onConfirmText: '确认激活',
      onConfirm: async () => {
        await onReactivate(wallet.id);
      },
    });
  }, [wallet.id, onReactivate]);

  const handleExportMnemonic = useCallback(() => {
    Dialog.confirm({
      title: '导出 Bot 助记词',
      description:
        'Bot 钱包的助记词将被导出到外部环境使用。其安全性取决于你的运行环境，与 Keyless 主钱包的安全等级不同。Bot 钱包丢失不会影响你的 Keyless 主钱包资产。',
      onConfirmText: '继续',
      onConfirm: () => {
        navigation.pushModal(EModalRoutes.PrimeModal, {
          screen: EPrimePages.PrimeTransfer,
          params: {
            botWalletId: wallet.id,
          },
        });
      },
    });
  }, [navigation, wallet.id]);

  const handleVisibilityPress = useCallback(async () => {
    await handleVisibilityToggle(!metadata.visible);
  }, [handleVisibilityToggle, metadata.visible]);

  const handleRename = useCallback(() => {
    showRenameDialog(metadata.name, {
      intl,
      disabledMaxLengthLabel: true,
      nameHistoryInfo: {
        entityId: wallet.id,
        entityType: EChangeHistoryEntityType.Wallet,
        contentType: EChangeHistoryContentType.Name,
      },
      onSubmit: async (name) => {
        await onRename({
          walletId: wallet.id,
          name,
        });
      },
    });
  }, [metadata.name, onRename, wallet.id, intl]);

  return (
    <XStack
      px="$4"
      py="$3"
      alignItems="center"
      justifyContent="space-between"
      borderBottomWidth="$px"
      borderBottomColor="$borderSubdued"
    >
      <XStack flex={1} mr="$3" alignItems="center" gap="$2">
        {canToggleVisibility ? (
          <IconButton
            size="small"
            variant="tertiary"
            icon={visibilityIcon}
            iconProps={{ color: visibilityIconColor }}
            title="显示到主界面"
            onPress={handleVisibilityPress}
            accessibilityLabel={visibilityAccessibilityLabel}
          />
        ) : null}

        <YStack flex={1}>
          <XStack alignItems="center" gap="$2">
            <XStack
              py="$1"
              px="$1.5"
              ml="$-1.5"
              alignItems="center"
              borderRadius="$2"
              flexShrink={1}
              role="button"
              onPress={handleRename}
              userSelect="none"
              hoverStyle={{
                bg: '$bgHover',
              }}
              pressStyle={{
                bg: '$bgActive',
              }}
              focusable
              focusVisibleStyle={{
                outlineOffset: 2,
                outlineWidth: 2,
                outlineColor: '$focusRing',
                outlineStyle: 'solid',
              }}
              accessibilityLabel={`修改 ${metadata.name} 名称`}
            >
              <SizableText size="$bodyLgMedium" pr="$1.5" numberOfLines={1}>
                {metadata.name}
              </SizableText>
              <Icon
                flexShrink={0}
                name="PencilSolid"
                size="$4"
                color="$iconSubdued"
              />
            </XStack>
            {isDeactivated ? (
              <Stack
                px="$1.5"
                py="$0.5"
                borderRadius="$1"
                backgroundColor="$bgCautionSubdued"
              >
                <SizableText size="$bodySm" color="$textCaution">
                  已停用
                </SizableText>
              </Stack>
            ) : null}
          </XStack>
          <Badge badgeSize="sm" badgeType="default" alignSelf="flex-start">
            <Badge.Text>{formatBotWalletBadgeLabel(entry)}</Badge.Text>
          </Badge>
        </YStack>
      </XStack>

      <XStack
        alignItems="center"
        gap="$3"
        flexWrap="wrap"
        justifyContent="flex-end"
      >
        {canExportMnemonic ? (
          <Button size="small" variant="primary" onPress={handleExportMnemonic}>
            导出
          </Button>
        ) : null}

        {canDeactivate ? (
          <Button size="small" variant="tertiary" onPress={handleDeactivate}>
            停用
          </Button>
        ) : null}

        {canReactivate ? (
          <Button size="small" variant="tertiary" onPress={handleReactivate}>
            激活
          </Button>
        ) : null}
      </XStack>
    </XStack>
  );
}

function BotWalletManagerContent() {
  const intl = useIntl();
  const route = useAppRoute<
    IAccountManagerStacksParamList,
    EAccountManagerStacksRoutes.BotWalletManager
  >();
  const { parentKeylessWalletId } = route.params;
  const actions = useAccountSelectorActions();
  const { activeAccount } = useActiveAccount({ num: 0 });
  const { selectedAccount } = useSelectedAccount({ num: 0 });

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [entries, setEntries] = useState<IBotWalletEntry[]>([]);

  const loadBotWallets = useCallback(
    async ({ showLoading = false }: { showLoading?: boolean } = {}) => {
      if (showLoading) {
        setLoading(true);
      }
      try {
        const result = await backgroundApiProxy.serviceAccount.getBotWallets({
          parentKeylessWalletId,
        });
        setEntries(result);
      } finally {
        if (showLoading) {
          setLoading(false);
        }
      }
    },
    [parentKeylessWalletId],
  );

  const updateEntryMetadata = useCallback(
    (walletId: string, metadataPatch: Partial<IBotWalletMetadata>) => {
      setEntries((prevEntries) =>
        updateBotWalletEntryMetadata(prevEntries, walletId, metadataPatch),
      );
    },
    [],
  );

  const emitWalletUpdate = useCallback(() => {
    appEventBus.emit(EAppEventBusNames.WalletUpdate, undefined);
  }, []);

  useEffect(() => {
    void loadBotWallets({ showLoading: true });
  }, [loadBotWallets]);

  useEffect(() => {
    const handleWalletUpdate = async () => {
      await loadBotWallets();
    };
    appEventBus.on(EAppEventBusNames.WalletUpdate, handleWalletUpdate);
    return () => {
      appEventBus.off(EAppEventBusNames.WalletUpdate, handleWalletUpdate);
    };
  }, [loadBotWallets]);

  const handleCurrentHomeWalletHidden = useCallback(
    async (walletId: string) => {
      const isCurrentHomeWallet =
        selectedAccount.focusedWallet === walletId ||
        selectedAccount.walletId === walletId ||
        activeAccount.wallet?.id === walletId;

      if (!isCurrentHomeWallet) {
        return;
      }

      await actions.current.clearSelectedAccount({
        num: 0,
        clearAccount: true,
      });

      const nextSelectedAccount = actions.current.getSelectedAccount({
        num: 0,
      });

      await actions.current.reloadActiveAccountInfo({
        num: 0,
        selectedAccount: nextSelectedAccount,
      });

      await actions.current.autoSelectNextAccount({
        num: 0,
        sceneName: EAccountSelectorSceneName.home,
      });
    },
    [
      actions,
      activeAccount.wallet?.id,
      selectedAccount.focusedWallet,
      selectedAccount.walletId,
    ],
  );

  const handleBotWalletVisibilityToggle = useCallback(
    async ({
      walletId,
      walletName,
      visible,
    }: {
      walletId: string;
      walletName: string;
      visible: boolean;
    }) => {
      await backgroundApiProxy.serviceAccount.updateBotWalletVisibility({
        walletId,
        visible,
      });

      updateEntryMetadata(walletId, {
        visible,
      });
      emitWalletUpdate();

      if (!visible) {
        await handleCurrentHomeWalletHidden(walletId);
      }

      void backgroundApiProxy.serviceApp.showToast({
        method: 'success',
        title: visible
          ? `${walletName} 已显示在主界面`
          : `${walletName} 已从主界面隐藏`,
      });
    },
    [emitWalletUpdate, handleCurrentHomeWalletHidden, updateEntryMetadata],
  );

  const handleRenameBotWallet = useCallback(
    async ({ walletId, name }: { walletId: string; name: string }) => {
      await backgroundApiProxy.serviceAccount.renameBotWallet({
        walletId,
        name,
      });

      updateEntryMetadata(walletId, {
        name: name.trim(),
      });
    },
    [updateEntryMetadata],
  );

  const handleDeactivateBotWallet = useCallback(
    async (walletId: string) => {
      await backgroundApiProxy.serviceAccount.deactivateBotWallet({
        walletId,
      });
      updateEntryMetadata(walletId, {
        status: BOT_WALLET_STATUS_DEACTIVATED,
        deactivatedAt: Date.now(),
      });
      emitWalletUpdate();
    },
    [emitWalletUpdate, updateEntryMetadata],
  );

  const handleReactivateBotWallet = useCallback(
    async (walletId: string) => {
      await backgroundApiProxy.serviceAccount.reactivateBotWallet({
        walletId,
      });
      updateEntryMetadata(walletId, {
        status: BOT_WALLET_STATUS_ACTIVE,
        deactivatedAt: undefined,
      });
      emitWalletUpdate();
    },
    [emitWalletUpdate, updateEntryMetadata],
  );

  const sections = buildBotWalletSections(entries);

  const handleCreate = useCallback(() => {
    let botName = '';
    Dialog.confirm({
      title: '创建 Bot 钱包',
      description:
        '为新的 Bot 钱包指定一个名称。Bot 钱包将从 Keyless 主钱包安全派生。',
      renderContent: (
        <Stack py="$2">
          <Input
            placeholder="Bot 钱包名称"
            onChangeText={(text: string) => {
              botName = text;
            }}
          />
        </Stack>
      ),
      onConfirmText: '创建',
      onConfirm: async () => {
        await backgroundApiProxy.serviceAccount.createBotWallet({
          parentKeylessWalletId,
          name: botName || '',
        });
        await loadBotWallets();
        emitWalletUpdate();
      },
    });
  }, [emitWalletUpdate, parentKeylessWalletId, loadBotWallets]);

  const handleRefresh = useCallback(async () => {
    if (refreshing) {
      return;
    }

    setRefreshing(true);
    try {
      const hasCachedPassword =
        await backgroundApiProxy.servicePassword.hasCachedPassword();
      if (!hasCachedPassword) {
        await backgroundApiProxy.servicePassword.promptPasswordVerify();
      }

      await backgroundApiProxy.serviceApp.showDialogLoading({
        title: intl.formatMessage({
          id: ETranslations.global_syncing,
        }),
      });

      let syncSuccess = false;
      try {
        syncSuccess =
          await backgroundApiProxy.servicePrimeCloudSync.syncNowKeyless({
            callerName: 'Bot Wallet Manager Refresh',
            noDebounceUpload: true,
            forceSync: true,
          });
      } finally {
        await backgroundApiProxy.serviceApp.hideDialogLoading();
      }

      if (!syncSuccess) {
        void backgroundApiProxy.serviceApp.showToast({
          method: 'error',
          title: '请先开启 Keyless 云同步',
        });
        return;
      }

      await loadBotWallets();
      emitWalletUpdate();

      void backgroundApiProxy.serviceApp.showToast({
        method: 'success',
        title: intl.formatMessage({
          id: ETranslations.global_sync_successfully,
        }),
      });
    } finally {
      setRefreshing(false);
    }
  }, [emitWalletUpdate, intl, loadBotWallets, refreshing]);

  const headerRight = useCallback(
    () => (
      <IconButton
        title={intl.formatMessage({ id: ETranslations.global_refresh })}
        variant="tertiary"
        icon="RefreshCwOutline"
        loading={refreshing}
        onPress={() => {
          void handleRefresh();
        }}
      />
    ),
    [handleRefresh, intl, refreshing],
  );

  let bodyContent = (
    <SectionList
      sections={sections}
      keyExtractor={(item) => (item as IBotWalletEntry).wallet.id}
      renderSectionHeader={({ section }: { section: IBotWalletSection }) =>
        section.title ? (
          <Stack px="$4" py="$2" backgroundColor="$bgSubdued">
            <SizableText size="$bodySmMedium" color="$textSubdued">
              {section.title}
            </SizableText>
          </Stack>
        ) : null
      }
      renderItem={({ item }: { item: IBotWalletEntry }) => (
        <BotWalletListItem
          entry={item}
          onRename={handleRenameBotWallet}
          onVisibilityToggle={handleBotWalletVisibilityToggle}
          onDeactivate={handleDeactivateBotWallet}
          onReactivate={handleReactivateBotWallet}
        />
      )}
    />
  );

  if (loading) {
    bodyContent = (
      <Stack flex={1} alignItems="center" justifyContent="center">
        <Spinner size="large" />
      </Stack>
    );
  } else if (entries.length === 0) {
    bodyContent = (
      <Empty
        title="暂无 Bot 钱包"
        description="创建 Bot 钱包以用于自动化操作"
      />
    );
  }

  return (
    <Page>
      <Page.Header title="Bot 钱包管理" headerRight={headerRight} />
      <Page.Body>{bodyContent}</Page.Body>
      <Page.Footer>
        <Button variant="primary" size="large" onPress={handleCreate} m="$4">
          + 创建 Bot 钱包
        </Button>
      </Page.Footer>
    </Page>
  );
}

function BotWalletManager() {
  return (
    <AccountSelectorProviderMirror
      enabledNum={[0]}
      config={{ sceneName: EAccountSelectorSceneName.home }}
    >
      <BotWalletManagerContent />
    </AccountSelectorProviderMirror>
  );
}

export default BotWalletManager;
