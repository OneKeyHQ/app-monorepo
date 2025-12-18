import { Dialog, SizableText, Toast, YStack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';

interface IShowCustomRpcFallbackDialogParams {
  networkId: string;
  accountId: string;
  customRpcUrl: string;
  onClose?: () => void;
}

function DialogContent({ customRpcUrl }: { customRpcUrl: string }) {
  return (
    <YStack gap="$4">
      <SizableText size="$bodyMd" color="$textSubdued">
        {`Your custom RPC (${customRpcUrl}) is not responding. Would you like to switch to the default RPC to continue?`}
      </SizableText>
    </YStack>
  );
}

export function showCustomRpcFallbackDialog(
  params: IShowCustomRpcFallbackDialogParams,
) {
  const { networkId, customRpcUrl, onClose } = params;

  const handleSwitchToDefaultRpc = async () => {
    try {
      await backgroundApiProxy.serviceCustomRpc.deleteCustomRpc({
        customRpc: {
          networkId,
          rpc: customRpcUrl,
          enabled: true,
          updatedAt: undefined,
        },
      });
      Toast.success({
        title: 'Switched to default RPC',
      });
      onClose?.();
    } catch (error) {
      Toast.error({
        title: (error as Error).message || 'Operation failed',
      });
    }
  };

  Dialog.show({
    icon: 'BezierNodesOutline',
    title: 'Custom RPC Unavailable',
    renderContent: <DialogContent customRpcUrl={customRpcUrl} />,
    showCancelButton: true,
    onConfirmText: 'Switch to Default',
    onConfirm: async ({ close }) => {
      await handleSwitchToDefaultRpc();
      await close();
    },
    onCancel: () => {
      onClose?.();
    },
  });
}
