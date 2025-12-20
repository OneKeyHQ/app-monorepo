import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Toast } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePrimeTransferAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { OneKeyError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  EChangeHistoryContentType,
  EChangeHistoryEntityType,
} from '@onekeyhq/shared/src/types/changeHistory';
import { EPrimeTransferServerType } from '@onekeyhq/shared/types/prime/primeTransferTypes';

export function usePrimeTransferSaveCustomServer() {
  const intl = useIntl();
  const [, setPrimeTransferAtom] = usePrimeTransferAtom();

  const saveCustomServerConfig = useCallback(
    async ({
      customServerTrimmed,
      serverType,
      setCustomServer,
    }: {
      customServerTrimmed: string;
      serverType: EPrimeTransferServerType;
      setCustomServer?: (value: string) => void;
    }) => {
      try {
        let finalCustomServerUrl = customServerTrimmed;
        // Validate custom server URL if custom type is selected
        if (serverType === EPrimeTransferServerType.CUSTOM) {
          // Verify server endpoint
          const verificationResult =
            await backgroundApiProxy.servicePrimeTransfer.verifyWebSocketEndpoint(
              customServerTrimmed,
            );

          if (!verificationResult.isValid) {
            throw new OneKeyError(
              intl.formatMessage({
                id: ETranslations.transfer_transfer_server_status_connect_failed,
              }),
            );
          }

          // Update input with corrected URL if different
          if (
            verificationResult.correctedUrl &&
            verificationResult.correctedUrl !== customServerTrimmed
          ) {
            finalCustomServerUrl = verificationResult.correctedUrl;
            setCustomServer?.(finalCustomServerUrl);
          }
        }

        // Get current config to track changes
        const currentConfig =
          await backgroundApiProxy.simpleDb.primeTransfer.getServerConfig();

        // Save new config
        await backgroundApiProxy.simpleDb.primeTransfer.saveServerConfig({
          serverType,
          customServerUrl:
            serverType === EPrimeTransferServerType.CUSTOM
              ? finalCustomServerUrl
              : currentConfig.customServerUrl,
        });

        // Add to change history if custom server URL changed
        if (
          serverType === EPrimeTransferServerType.CUSTOM &&
          finalCustomServerUrl &&
          finalCustomServerUrl !== currentConfig.customServerUrl
        ) {
          await backgroundApiProxy.simpleDb.changeHistory.addChangeHistory({
            items: [
              {
                entityType: EChangeHistoryEntityType.PrimeTransfer,
                entityId: 'server',
                contentType: EChangeHistoryContentType.ServerUrl,
                oldValue: currentConfig.customServerUrl || '',
                value: finalCustomServerUrl,
              },
            ],
          });
        }

        setPrimeTransferAtom((v) => ({
          ...v,
          websocketEndpointUpdatedAt: Date.now(),
        }));
      } catch (error) {
        const e = error as OneKeyError | undefined;
        console.error('Failed to save server config to simpleDB:', error);
        Toast.error({
          title:
            e?.message ||
            intl.formatMessage({
              id: ETranslations.transfer_transfer_server_status_connect_failed,
            }),
        });
        throw error;
      }
    },
    [intl, setPrimeTransferAtom],
  );

  return saveCustomServerConfig;
}
