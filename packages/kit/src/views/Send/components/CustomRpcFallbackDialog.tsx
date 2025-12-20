import { useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Checkbox,
  Dialog,
  SizableText,
  Toast,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ETranslations } from '@onekeyhq/shared/src/locale';

interface IShowCustomRpcFallbackDialogParams {
  title: string;
  confirmText: string;
  cancelText: string;
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
  const intl = useIntl();
  const [setAsDefault, setSetAsDefault] = useState(false);

  return (
    <YStack gap="$4">
      <SizableText size="$bodyLg" color="$textSubdued">
        {intl.formatMessage({
          id: ETranslations.transfer_send_onekey_rpc_desc,
        })}
      </SizableText>
      <Checkbox
        value={setAsDefault}
        label={intl.formatMessage({
          id: ETranslations.transfer_send_onekey_rpc_default,
        })}
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
  const {
    title,
    confirmText,
    cancelText,
    networkId,
    onSwitchOnce,
    onSwitchPermanently,
    onCancel,
  } = params;

  let setAsDefaultValue = false;

  const handleSwitch = async (
    close: (extra?: { flag?: string }) => Promise<void> | void,
  ) => {
    if (setAsDefaultValue) {
      try {
        await backgroundApiProxy.serviceCustomRpc.updateCustomRpcEnabledStatus({
          networkId,
          enabled: false,
        });
        onSwitchPermanently?.();
      } catch (error) {
        Toast.error({
          title: (error as Error).message || 'Operation failed',
        });
      }
    } else {
      onSwitchOnce?.();
    }
    await close();
  };

  Dialog.show({
    title,
    renderContent: (
      <DialogContentWrapper
        onSetAsDefaultChange={(value) => {
          setAsDefaultValue = value;
        }}
      />
    ),
    showCancelButton: true,
    onCancelText: cancelText,
    onConfirmText: confirmText,
    onConfirm: async ({ close }) => {
      await handleSwitch(close);
    },
    onCancel: () => {
      onCancel?.();
    },
  });
}
