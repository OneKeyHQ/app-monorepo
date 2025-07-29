import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import type { ISizableTextProps } from '@onekeyhq/components';
import {
  Alert,
  Icon,
  SizableText,
  Stack,
  XStack,
  useClipboard,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { usePrimeTransferAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EPrimeTransferServerType } from '@onekeyhq/shared/types/prime/primeTransferTypes';

import { showPrimeTransferServerConfigDialog } from './PrimeTransferServerConfigDialog';

export function PrimeTransferServerStatusBar() {
  const [primeTransferAtom] = usePrimeTransferAtom();
  const intl = useIntl();
  const { copyText } = useClipboard();

  const { websocketConnected, websocketError } = primeTransferAtom;

  const getConnectionState = () => {
    if (websocketConnected) {
      return 'connected';
    }
    if (!websocketConnected && !websocketError) {
      return 'connecting';
    }
    return 'failed';
  };

  const connectionState = getConnectionState();

  const handleCopyServerUrl = useCallback(async () => {
    try {
      const config =
        await backgroundApiProxy.simpleDb.primeTransfer.getServerConfig();
      let urlToCopy = '';

      if (
        config.serverType === EPrimeTransferServerType.CUSTOM &&
        config.customServerUrl
      ) {
        urlToCopy = config.customServerUrl;
        copyText(urlToCopy);
      }
    } catch (error) {
      console.error('Failed to copy server URL:', error);
    }
  }, [copyText]);

  const getAlertProps = useCallback(async () => {
    const config =
      await backgroundApiProxy.simpleDb.primeTransfer.getServerConfig();
    switch (connectionState) {
      case 'connected': {
        const serverName =
          config.serverType === EPrimeTransferServerType.CUSTOM
            ? config.customServerUrl
            : intl.formatMessage({
                id: ETranslations.transfer_transfer_server_server_official,
              });

        const isCustomServer =
          config.serverType === EPrimeTransferServerType.CUSTOM;

        return {
          type: 'success' as const,
          icon: 'ServerOutline' as const,
          renderTitle: (props: ISizableTextProps) => (
            <XStack
              alignItems="center"
              gap="$2"
              {...(isCustomServer && {
                onPress: handleCopyServerUrl,
                hoverStyle: {
                  opacity: 0.8,
                  cursor: 'pointer',
                },
                pressStyle: {
                  opacity: 0.6,
                },
              })}
            >
              <SizableText {...props}>
                {intl.formatMessage(
                  {
                    id: ETranslations.transfer_transfer_server_status_connected,
                  },
                  { serverName },
                )}
              </SizableText>
              {isCustomServer ? (
                <Stack w="$4">
                  <Icon name="Copy3Outline" size="$4" color="$iconSubdued" />
                </Stack>
              ) : null}
            </XStack>
          ),
        };
      }
      case 'connecting':
        return {
          type: 'info' as const,
          icon: 'ServerOutline' as const,
          title: intl.formatMessage({
            id: ETranslations.transfer_transfer_server_status_connecting,
          }),
        };
      case 'failed':
        return {
          type: 'critical' as const,
          icon: 'ServerOutline' as const,
          title: intl.formatMessage({
            id: ETranslations.transfer_transfer_server_status_connect_failed,
          }),
        };
      default:
        return {
          type: 'info' as const,
          icon: 'ServerOutline' as const,
          title: 'Unknown state',
        };
    }
  }, [connectionState, intl, handleCopyServerUrl]);

  const handleServerConfig = (
    serverType: EPrimeTransferServerType,
    customServer?: string,
  ) => {
    // TODO: Implement server configuration logic
    console.log('Server config:', { serverType, customServer });
  };

  const handleManagePress = () => {
    showPrimeTransferServerConfigDialog({
      onConfirm: handleServerConfig,
    });
  };

  const { result: alertProps } = usePromiseResult(
    () => getAlertProps(),
    [getAlertProps],
  );

  return (
    <Alert
      mx="$4"
      type={alertProps?.type}
      icon={alertProps?.icon}
      title={alertProps?.title}
      renderTitle={alertProps?.renderTitle}
      action={{
        primary: intl.formatMessage({
          id: ETranslations.global_manage,
        }),
        onPrimaryPress: handleManagePress,
      }}
    />
  );
}
