import { useCallback } from 'react';

import {
  Button,
  Checkbox,
  Dialog,
  Input,
  Toast,
  YStack,
} from '@onekeyhq/components';
import { useDevSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/devSettings';
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

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useKeylessWallet } from '../../../components/KeylessWallet/useKeylessWallet';
import { MultipleClickStack } from '../../../components/MultipleClickStack';
import useAppNavigation from '../../../hooks/useAppNavigation';

export function KeylessOnboardingDebugPanel({
  isResetMode,
  onResetModeChange,
}: {
  isResetMode?: boolean;
  onResetModeChange?: (val: boolean) => void;
}) {
  const _navigation = useAppNavigation();
  const { cacheKeylessOnboardingCustomMnemonic } = useKeylessWallet();
  const [devSettings] = useDevSettingsPersistAtom();
  const isDeletionAllowed =
    devSettings.enabled && !!devSettings.settings?.allowDeleteKeylessKey;

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
    <YStack>
      <MultipleClickStack
        h="$10"
        w="100%"
        showDevBgColor
        debugComponent={
          <YStack gap="$2" py="$4">
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

            <Button onPress={handleImportCustomMnemonic}>
              自定义助记词创建钱包
            </Button>

            <Button onPress={handleShowAuthConsts}>显示 Auth Consts</Button>
          </YStack>
        }
      />
    </YStack>
  );
}
