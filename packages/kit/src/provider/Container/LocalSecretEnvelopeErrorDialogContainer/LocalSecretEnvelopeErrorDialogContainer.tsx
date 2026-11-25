import { useCallback, useEffect, useRef, useState } from 'react';

import { useIntl } from 'react-intl';
import { AppState } from 'react-native';

import { resetToRoute } from '@onekeyhq/components';
import { useAppIsLockedAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/passwordLock';
import type { ILocalSecretEnvelopeCredentialIssue } from '@onekeyhq/shared/src/errors/utils/localSecretEnvelopeErrorData';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import type { IAppEventBusPayload } from '@onekeyhq/shared/src/eventBus/appEventBus';
import {
  EOnboardingPagesV2,
  EOnboardingV2Routes,
  ERootRoutes,
} from '@onekeyhq/shared/src/routes';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { AccountSelectorProviderMirror } from '../../../components/AccountSelector/AccountSelectorProvider';
import {
  getActiveWalletLocalSecretEnvelopeCredentialId,
  useWalletLocalSecretEnvelopePreflight,
} from '../../../components/AccountSelector/hooks/useWalletLocalSecretEnvelopePreflight';
import {
  showLocalSecretEnvelopeDetailsToast,
  showLocalSecretEnvelopeRecoveryDialog,
} from '../../../components/LocalSecretEnvelopeRecovery/localSecretEnvelopeRecovery';
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
  useWalletLocalSecretEnvelopePreflight(
    enabled
      ? getActiveWalletLocalSecretEnvelopeCredentialId(activeAccount)
      : undefined,
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
    showLocalSecretEnvelopeRecoveryDialog({
      intl,
      context: 'wallet',
      onAction: () => {
        resetToRoute(ERootRoutes.Onboarding, {
          screen: EOnboardingV2Routes.OnboardingV2,
          params: {
            screen: EOnboardingPagesV2.GetStarted,
          },
        });
      },
      options: {
        confirmButtonProps: { testID: 'lse-recovery-import-wallet' },
        onClose: () => {
          dialogOpen.current = false;
        },
      },
    });
  }, [foreground, intl, isLocked]);

  useEffect(() => {
    const showToast = (
      issue: IAppEventBusPayload[EAppEventBusNames.ShowLocalSecretEnvelopeRecoveryToast],
    ) => {
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
      showLocalSecretEnvelopeDetailsToast({
        intl,
        message: issue.walletName,
        toastId: `wallet-lse:${toastKey}`,
        onDetails: showDialog,
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
  }, [foreground, intl, isLocked, showDialog]);

  return (
    <AccountSelectorProviderMirror
      config={{ sceneName: EAccountSelectorSceneName.home }}
      enabledNum={[0]}
    >
      <WalletLocalSecretEnvelopePreflight enabled={foreground && !isLocked} />
    </AccountSelectorProviderMirror>
  );
}
