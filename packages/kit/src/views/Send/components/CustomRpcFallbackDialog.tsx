import { useState } from 'react';

import {
  Checkbox,
  Dialog,
  SizableText,
  Toast,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';

interface IShowCustomRpcFallbackDialogParams {
  networkId: string;
  onSwitchOnce?: () => void;
  onSwitchPermanently?: () => void;
  onCancel?: () => void;
}

function DialogContentWrapper({
  onSetAsDefaultChange,
}: {
  onSetAsDefaultChange: (value: boolean) => void;
}) {
  const [setAsDefault, setSetAsDefault] = useState(false);

  return (
    <YStack gap="$4">
      <SizableText size="$bodyLg" color="$textSubdued">
        We recommend using OneKey RPC to continue sending this transaction
        successfully.
      </SizableText>
      <Checkbox
        value={setAsDefault}
        label="Set OneKey RPC as default"
        onChange={(value) => {
          setSetAsDefault(!!value);
          onSetAsDefaultChange(!!value);
        }}
      />
    </YStack>
  );
}

export function showCustomRpcFallbackDialog(
  params: IShowCustomRpcFallbackDialogParams,
) {
  const { networkId, onSwitchOnce, onSwitchPermanently, onCancel } = params;

  let setAsDefaultValue = false;

  const handleSwitch = async (close: () => Promise<void>) => {
    if (setAsDefaultValue) {
      // Permanently disable custom RPC
      try {
        await backgroundApiProxy.serviceCustomRpc.updateCustomRpcEnabledStatus({
          networkId,
          enabled: false,
        });
        Toast.success({
          title: 'OneKey RPC set as default',
        });
        onSwitchPermanently?.();
      } catch (error) {
        Toast.error({
          title: (error as Error).message || 'Operation failed',
        });
      }
    } else {
      // One-time switch
      onSwitchOnce?.();
    }
    await close();
  };

  Dialog.show({
    title: 'Send via OneKey RPC',
    renderContent: (
      <DialogContentWrapper
        onSetAsDefaultChange={(value) => {
          setAsDefaultValue = value;
        }}
      />
    ),
    showCancelButton: true,
    onCancelText: 'Cancel',
    onConfirmText: 'Switch to OneKey RPC',
    onConfirm: async ({ close }) => {
      await handleSwitch(close);
    },
    onCancel: () => {
      onCancel?.();
    },
  });
}
