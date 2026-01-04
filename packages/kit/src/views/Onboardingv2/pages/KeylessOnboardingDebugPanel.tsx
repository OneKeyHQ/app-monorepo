import { useCallback } from 'react';

import {
  Button,
  Checkbox,
  Dialog,
  Input,
  Toast,
  YStack,
} from '@onekeyhq/components';

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
  const navigation = useAppNavigation();
  const { cacheKeylessOnboardingCustomMnemonic } = useKeylessWallet();

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
              onChange={(checked) => {
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
          </YStack>
        }
      />
    </YStack>
  );
}
