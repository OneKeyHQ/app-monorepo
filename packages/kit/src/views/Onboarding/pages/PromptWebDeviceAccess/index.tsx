import { useCallback, useMemo, useState } from 'react';

import { Button, Page, SizableText, Stack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromptWebDeviceAccess } from '@onekeyhq/kit/src/hooks/usePromptWebDeviceAccess';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

function PromptWebDeviceAccessPage() {
  const [isConnecting, setIsConnecting] = useState(false);
  const { promptWebUsbDeviceAccess } = usePromptWebDeviceAccess();

  const handleConnect = useCallback(async () => {
    setIsConnecting(true);
    try {
      await promptWebUsbDeviceAccess();
      if (platformEnv.isExtensionUiExpandTab) {
        await backgroundApiProxy.serviceApp.restartApp();
        window.close();
      }
    } catch (error) {
      console.error('USB device connection failed:', error);
    } finally {
      setIsConnecting(false);
    }
  }, [promptWebUsbDeviceAccess]);

  const content = useMemo(
    () => (
      <Stack alignItems="center" p="$5" gap="$5">
        <SizableText textAlign="center">
          Click the "Connect" button to allow OneKey to access your USB device
        </SizableText>
        <Button size="large" onPress={handleConnect} loading={isConnecting}>
          Connect
        </Button>
      </Stack>
    ),
    [handleConnect, isConnecting],
  );

  return (
    <Page>
      <Page.Header title="Device Authorization" />
      <Page.Body>{content}</Page.Body>
    </Page>
  );
}

export default PromptWebDeviceAccessPage;
