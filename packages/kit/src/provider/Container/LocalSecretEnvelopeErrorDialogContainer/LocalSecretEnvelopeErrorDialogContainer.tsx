import { useCallback, useEffect, useRef, useState } from 'react';

import { useIntl } from 'react-intl';
import { AppState } from 'react-native';

import { Dialog, Toast, resetToRoute } from '@onekeyhq/components';
import { useAppIsLockedAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/passwordLock';
import type { ILocalSecretEnvelopeCredentialIssue } from '@onekeyhq/shared/src/errors/utils/localSecretEnvelopeErrorData';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations, ETranslationsMock } from '@onekeyhq/shared/src/locale';
import {
  EOnboardingPagesV2,
  EOnboardingV2Routes,
  ERootRoutes,
} from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { AccountSelectorProviderMirror } from '../../../components/AccountSelector/AccountSelectorProvider';
import { useWalletLocalSecretEnvelopePreflight } from '../../../components/AccountSelector/hooks/useWalletLocalSecretEnvelopePreflight';
import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector/atoms';

const TOAST_DEDUPLICATE_MS = 10_000;

function showWalletLocalSecretEnvelopeToast(
  issue: ILocalSecretEnvelopeCredentialIssue,
) {
  appEventBus.emit(
    EAppEventBusNames.ShowLocalSecretEnvelopeRecoveryToast,
    issue,
  );
}

function WalletLocalSecretEnvelopePreflight({ enabled }: { enabled: boolean }) {
  const { activeAccount } = useActiveAccount({ num: 0 });
  const walletId = activeAccount.wallet?.id;
  const accountId = activeAccount.dbAccount?.id;
  let credentialId: string | undefined;
  if (accountId && accountUtils.isImportedAccount({ accountId })) {
    credentialId = accountId;
  } else if (accountUtils.isHdWallet({ walletId })) {
    credentialId = walletId;
  }

  useWalletLocalSecretEnvelopePreflight(
    enabled && activeAccount.ready ? credentialId : undefined,
    showWalletLocalSecretEnvelopeToast,
  );

  return null;
}

export function LocalSecretEnvelopeErrorDialogContainer() {
  const intl = useIntl();
  const [isLocked] = useAppIsLockedAtom();
  const [foreground, setForeground] = useState(
    () => !AppState.currentState || AppState.currentState === 'active',
  );
  const dialogOpen = useRef(false);
  const lastToastAt = useRef(new Map<string, number>());
  const chinese = intl.locale.startsWith('zh');
  const title = intl.formatMessage({
    id: ETranslationsMock.wallet_lse_unavailable__title,
    defaultMessage: chinese
      ? '此设备无法解锁该钱包'
      : ETranslationsMock.wallet_lse_unavailable__title,
  });
  const description = intl.formatMessage({
    id: ETranslationsMock.wallet_lse_unavailable__desc,
    defaultMessage: chinese
      ? '换机、迁移或重装后可能出现此问题。下一步可选择导入或恢复钱包的方式。'
      : ETranslationsMock.wallet_lse_unavailable__desc,
  });

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      setForeground(state === 'active');
    });
    return () => subscription.remove();
  }, []);

  const showDialog = useCallback(() => {
    if (dialogOpen.current || isLocked || !foreground) {
      return;
    }
    dialogOpen.current = true;
    Dialog.show({
      icon: 'ErrorOutline',
      title,
      description,
      onCancelText: intl.formatMessage({ id: ETranslations.global_close }),
      onConfirmText: intl.formatMessage({
        id: ETranslationsMock.wallet_lse_import_again__action,
        defaultMessage: chinese
          ? '重新导入钱包'
          : ETranslationsMock.wallet_lse_import_again__action,
      }),
      confirmButtonProps: { testID: 'lse-recovery-import-wallet' },
      onConfirm: async (dialog) => {
        await dialog.close();
        resetToRoute(ERootRoutes.Onboarding, {
          screen: EOnboardingV2Routes.OnboardingV2,
          params: {
            screen: EOnboardingPagesV2.CreateOrImportWallet,
          },
        });
      },
      onClose: () => {
        dialogOpen.current = false;
      },
    });
  }, [chinese, description, foreground, intl, isLocked, title]);

  useEffect(() => {
    const showToast = (issue: ILocalSecretEnvelopeCredentialIssue) => {
      if (!foreground || isLocked) {
        return;
      }
      const now = Date.now();
      for (const [key, timestamp] of lastToastAt.current) {
        if (now - timestamp >= TOAST_DEDUPLICATE_MS) {
          lastToastAt.current.delete(key);
        }
      }
      const toastKey = issue.credentialKey;
      if (lastToastAt.current.has(toastKey)) {
        return;
      }
      lastToastAt.current.set(toastKey, now);
      Toast.error({
        title,
        message:
          issue.reason === 'key-missing'
            ? intl.formatMessage({
                id: ETranslationsMock.wallet_lse_key_missing__msg,
                defaultMessage: chinese
                  ? '设备密钥缺失'
                  : ETranslationsMock.wallet_lse_key_missing__msg,
              })
            : intl.formatMessage({
                id: ETranslationsMock.wallet_lse_authentication_failed__msg,
                defaultMessage: chinese
                  ? '加密信封外层认证失败'
                  : ETranslationsMock.wallet_lse_authentication_failed__msg,
              }),
        toastId: `wallet-lse:${toastKey}`,
        actions: {
          label: intl.formatMessage({ id: ETranslations.global_details }),
          testID: 'lse-recovery-toast-details',
          onPress: showDialog,
        },
      });
    };
    appEventBus.on(
      EAppEventBusNames.ShowLocalSecretEnvelopeRecoveryToast,
      showToast,
    );
    appEventBus.on(
      EAppEventBusNames.ShowLocalSecretEnvelopeErrorDialog,
      showDialog,
    );
    return () => {
      appEventBus.off(
        EAppEventBusNames.ShowLocalSecretEnvelopeRecoveryToast,
        showToast,
      );
      appEventBus.off(
        EAppEventBusNames.ShowLocalSecretEnvelopeErrorDialog,
        showDialog,
      );
    };
  }, [chinese, foreground, intl, isLocked, showDialog, title]);

  return (
    <AccountSelectorProviderMirror
      config={{ sceneName: EAccountSelectorSceneName.home }}
      enabledNum={[0]}
    >
      <WalletLocalSecretEnvelopePreflight enabled={foreground && !isLocked} />
    </AccountSelectorProviderMirror>
  );
}
