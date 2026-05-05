import { useCallback, useEffect, useRef, useState } from 'react';

import {
  Button,
  Checkbox,
  Dialog,
  Input,
  SizableText,
  Toast,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { useDevSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/devSettings';
import { useKeylessPinConfirmStatusAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/keyless';
import {
  GOOGLE_OAUTH_CLIENT_IDS,
  JUICEBOX_ALLOWED_GUESSES,
  JUICEBOX_AUTH_SERVER,
  JUICEBOX_CONFIG,
  KEYLESS_SUPABASE_PROJECT_URL,
  KEYLESS_SUPABASE_PUBLIC_API_KEY,
  SUPABASE_PROJECT_URL,
  SUPABASE_PUBLIC_API_KEY,
} from '@onekeyhq/shared/src/consts/authConsts';
import dateUtils from '@onekeyhq/shared/src/utils/dateUtils';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useKeylessWallet } from '../../../components/KeylessWallet/useKeylessWallet';
import { MultipleClickStack } from '../../../components/MultipleClickStack';
import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';

export function KeylessOnboardingDebugPanelView({
  isResetMode,
  onResetModeChange,
  isVerifyPinPage,
  onAutoInputPin,
  onForceEnableInput,
}: {
  isResetMode?: boolean;
  onResetModeChange?: (val: boolean) => void;
  isVerifyPinPage?: boolean;
  onAutoInputPin?: () => void;
  onForceEnableInput?: () => void;
}) {
  const [isAutoRetrying, setIsAutoRetrying] = useState(false);
  const autoRetryTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startAutoRetry = useCallback(() => {
    setIsAutoRetrying(true);
    Toast.success({ title: '自动重试已开始 (每5秒)' });

    // Immediately trigger once
    onForceEnableInput?.();
    onAutoInputPin?.();

    // Then set up interval for every 5 seconds
    autoRetryTimerRef.current = setInterval(() => {
      onForceEnableInput?.();
      onAutoInputPin?.();
    }, 5000);
  }, [onAutoInputPin, onForceEnableInput]);

  const stopAutoRetry = useCallback(() => {
    setIsAutoRetrying(false);
    if (autoRetryTimerRef.current) {
      clearInterval(autoRetryTimerRef.current);
      autoRetryTimerRef.current = null;
    }
    Toast.success({ title: '自动重试已停止' });
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (autoRetryTimerRef.current) {
        clearInterval(autoRetryTimerRef.current);
      }
    };
  }, []);
  const { cacheKeylessOnboardingCustomMnemonic } = useKeylessWallet();
  const [devSettings] = useDevSettingsPersistAtom();
  const [keylessPinConfirmStatus] = useKeylessPinConfirmStatusAtom();
  const isDeletionAllowed =
    devSettings.enabled && !!devSettings.settings?.allowDeleteKeylessKey;
  const { activeAccount } = useActiveAccount({ num: 0 });
  const keylessOwnerId =
    activeAccount.wallet?.keylessDetailsInfo?.keylessOwnerId;

  const handleImportCustomMnemonic = useCallback(() => {
    Dialog.confirm({
      title: 'Custom Mnemonic',
      renderContent: (
        <Dialog.Form
          formProps={{
            defaultValues: { mnemonic: '' },
          }}
        >
          <Dialog.FormField
            name="mnemonic"
            rules={{
              required: {
                value: true,
                message: 'Mnemonic is required',
              },
            }}
          >
            <Input
              autoFocus
              flex={1}
              placeholder="Enter your custom mnemonic phrase"
              secureTextEntry
            />
          </Dialog.FormField>
        </Dialog.Form>
      ),
      onConfirm: async (dialogInstance) => {
        const form = dialogInstance.getForm();
        if (!form) {
          return;
        }
        const { mnemonic } = form.getValues() as { mnemonic: string };
        if (!mnemonic?.trim()) {
          return;
        }

        await cacheKeylessOnboardingCustomMnemonic({
          customMnemonic: mnemonic.trim(),
        });

        Toast.success({
          title: 'Custom mnemonic saved.',
        });
      },
    });
  }, [cacheKeylessOnboardingCustomMnemonic]);

  const handleShowAuthConsts = useCallback(() => {
    const debugData = {
      GOOGLE_OAUTH_CLIENT_IDS,
      SUPABASE_PROJECT_URL,
      SUPABASE_PUBLIC_API_KEY,
      KEYLESS_SUPABASE_PROJECT_URL,
      KEYLESS_SUPABASE_PUBLIC_API_KEY,
      JUICEBOX_AUTH_SERVER,
      JUICEBOX_CONFIG,
      JUICEBOX_ALLOWED_GUESSES,
    };

    Dialog.debugMessage({
      title: 'Auth consts',
      debugMessage: debugData,
    });
  }, []);

  return (
    <YStack gap="$2" py="$4">
      {isVerifyPinPage ? (
        <XStack gap="$2" p="$2" backgroundColor="$bgCritical" borderRadius="$2">
          <Button
            flex={1}
            variant={isAutoRetrying ? 'destructive' : 'primary'}
            onPress={isAutoRetrying ? stopAutoRetry : startAutoRetry}
          >
            {isAutoRetrying ? '停止自动重试 PIN' : '开始自动重试 PIN'}
          </Button>
        </XStack>
      ) : null}

      {onResetModeChange ? (
        <Checkbox
          label="重置云端无私钥钱包（先勾选，再登录 Google 或 Apple 生效）"
          value={isResetMode}
          disabled={!isDeletionAllowed}
          onChangeForDisabled={() => {
            Toast.error({
              title: 'Operation not allowed',
              message:
                'Please enable "允许重置 Keyless 钱包" in Dev Settings first.',
            });
          }}
          onChange={(checked) => {
            // This reset flow may delete deviceKey/authKey, guard it with allowDeleteKeylessKey.
            if (!isDeletionAllowed) {
              Toast.error({
                title: 'Operation not allowed',
                message:
                  'Please enable "允许重置 Keyless 钱包" in Dev Settings first.',
              });
              return;
            }
            onResetModeChange?.(!!checked);
          }}
        />
      ) : null}

      <Button
        onPress={async () => {
          await backgroundApiProxy.servicePassword.clearCachedPassword();
          Toast.success({
            title: '已清空内存密码',
          });
        }}
      >
        清空内存密码
      </Button>

      <Button onPress={handleImportCustomMnemonic}>自定义助记词创建钱包</Button>

      <Button onPress={handleShowAuthConsts}>显示 Auth Consts</Button>

      <Button
        disabled={!keylessOwnerId}
        onPress={async () => {
          if (!keylessOwnerId) {
            Toast.error({
              title: '无法获取 Owner ID',
              message: '请先登录无私钥钱包',
            });
            return;
          }
          try {
            await backgroundApiProxy.serviceKeylessWallet.clearKeylessRefreshTokenStorage(
              {
                ownerId: keylessOwnerId,
              },
            );
            Toast.success({
              title: '已清空 Refresh Token Storage',
            });
          } catch (error: unknown) {
            Toast.error({
              title: '清空失败',
              message: (error as Error)?.message || 'Unknown error',
            });
          }
        }}
      >
        重置社交登录 Token
      </Button>

      {activeAccount?.wallet?.isKeyless ? null : (
        <SizableText size="$bodySmMedium">
          当前钱包不是 Keyless 钱包
        </SizableText>
      )}

      <YStack gap="$1" p="$2" backgroundColor="$bgSubdued" borderRadius="$2">
        <SizableText size="$bodySmMedium">Pin Confirm Status:</SizableText>
        <Button
          onPress={async () => {
            const accessToken =
              await backgroundApiProxy.serviceKeylessWallet.getKeylessCachedAccessToken(
                {
                  ownerId:
                    activeAccount?.wallet?.keylessDetailsInfo?.keylessOwnerId ??
                    '',
                },
              );
            if (accessToken) {
              await backgroundApiProxy.serviceKeylessWallet.apiGetPinConfirmStatus(
                {
                  token: accessToken,
                },
              );
            }
          }}
        >
          Refresh
        </Button>
        <SizableText size="$bodySm">
          socialUserIdHash: {keylessPinConfirmStatus?.socialUserIdHash ?? '-'}
        </SizableText>
        <SizableText size="$bodySm">
          socialProvider: {keylessPinConfirmStatus?.socialProvider ?? '-'}
        </SizableText>
        <SizableText size="$bodySm">
          needRemind: {keylessPinConfirmStatus?.needRemind?.toString() ?? '-'}
        </SizableText>
        <SizableText size="$bodySm">
          remindTime:{' '}
          {keylessPinConfirmStatus?.remindTime
            ? dateUtils.formatDate(new Date(keylessPinConfirmStatus.remindTime))
            : '-'}
        </SizableText>
        <SizableText size="$bodySm">
          confirmedCount: {keylessPinConfirmStatus?.confirmedCount ?? '-'}
        </SizableText>
      </YStack>
    </YStack>
  );
}

export function KeylessOnboardingDebugPanel({
  isResetMode,
  onResetModeChange,
  isVerifyPinPage,
  onAutoInputPin,
  onForceEnableInput,
}: {
  isResetMode?: boolean;
  onResetModeChange?: (val: boolean) => void;
  isVerifyPinPage?: boolean;
  onAutoInputPin?: () => void;
  onForceEnableInput?: () => void;
}) {
  return (
    <YStack>
      <MultipleClickStack
        h="$10"
        w="100%"
        showDevBgColor
        debugComponent={
          <KeylessOnboardingDebugPanelView
            isResetMode={isResetMode}
            onResetModeChange={onResetModeChange}
            isVerifyPinPage={isVerifyPinPage}
            onAutoInputPin={onAutoInputPin}
            onForceEnableInput={onForceEnableInput}
          />
        }
      />
    </YStack>
  );
}
