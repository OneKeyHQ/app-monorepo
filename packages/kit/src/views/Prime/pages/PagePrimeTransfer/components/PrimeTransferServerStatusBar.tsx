import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  IconButton,
  SizableText,
  Stack,
  XStack,
  useClipboard,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { usePrimeTransferAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import uriUtils from '@onekeyhq/shared/src/utils/uriUtils';
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

  const getStatusInfo = useCallback(async () => {
    const config =
      await backgroundApiProxy.simpleDb.primeTransfer.getServerConfig();

    switch (connectionState) {
      case 'connected': {
        const serverName =
          config?.customServerUrl &&
          config?.serverType === EPrimeTransferServerType.CUSTOM
            ? uriUtils.getHostNameFromUrl({ url: config.customServerUrl || '' })
            : intl.formatMessage({
                id: ETranslations.transfer_transfer_server_server_official,
              });

        return {
          iconColor: '$iconSuccess',
          bgColor: '$bgSuccess',
          text: intl.formatMessage(
            {
              id: ETranslations.transfer_transfer_server_status_connected,
            },
            { serverName },
          ),
          isCustomServer: config.serverType === EPrimeTransferServerType.CUSTOM,
        };
      }
      case 'connecting':
        return {
          iconColor: '$iconInfo',
          bgColor: '$bgInfo',
          text: intl.formatMessage({
            id: ETranslations.transfer_transfer_server_status_connecting,
          }),
          isCustomServer: false,
        };
      case 'failed':
        return {
          iconColor: '$iconCritical',
          bgColor: '$bgCritical',
          text: intl.formatMessage({
            id: ETranslations.transfer_transfer_server_status_connect_failed,
          }),
          isCustomServer: false,
        };
      default:
        return {
          iconColor: '$iconSubdued',
          bgColor: '$bgSubdued',
          text: 'Unknown state',
          isCustomServer: false,
        };
    }
  }, [connectionState, intl]);

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

  const { result: statusInfo } = usePromiseResult(
    () => getStatusInfo(),
    [getStatusInfo],
  );

  const handleTextPress = () => {
    if (statusInfo?.isCustomServer) {
      void handleCopyServerUrl();
    }
  };

  return (
    <XStack mx="$5" ai="center" gap="$3" py="$1.5">
      <XStack flex={1} gap="$2" ai="center">
        <Stack
          p="$1"
          borderRadius="$full"
          backgroundColor={statusInfo?.bgColor || '$bgSubdued'}
        >
          <Stack
            borderRadius="$full"
            w="$2"
            h="$2"
            backgroundColor={statusInfo?.iconColor || '$iconSubdued'}
          />
        </Stack>

        <SizableText
          size="$bodyMd"
          color="$text"
          numberOfLines={2}
          {...(statusInfo?.isCustomServer && {
            onPress: handleTextPress,
            hoverStyle: { opacity: 0.8, cursor: 'pointer' },
          })}
        >
          {statusInfo?.text}
        </SizableText>

        {statusInfo?.isCustomServer ? (
          <IconButton
            variant="tertiary"
            icon="Copy3Outline"
            size="small"
            onPress={handleTextPress}
          />
        ) : null}

        <Stack flex={1} />
      </XStack>

      <XStack gap="$4">
        <Button size="small" variant="tertiary" onPress={handleManagePress}>
          {intl.formatMessage({
            id: ETranslations.global_manage,
          })}
        </Button>
      </XStack>
    </XStack>
  );
}
