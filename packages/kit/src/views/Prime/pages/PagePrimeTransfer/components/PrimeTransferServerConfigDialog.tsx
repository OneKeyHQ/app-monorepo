import { useEffect, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Dialog,
  Input,
  Radio,
  SizableText,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { buildChangeHistoryInputAddon } from '@onekeyhq/kit/src/components/ChangeHistoryDialog/ChangeHistoryDialog';
import { HyperlinkText } from '@onekeyhq/kit/src/components/HyperlinkText';
import { usePrimeTransferAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import {
  EChangeHistoryContentType,
  EChangeHistoryEntityType,
} from '@onekeyhq/shared/src/types/changeHistory';
import { EPrimeTransferServerType } from '@onekeyhq/shared/types/prime/primeTransferTypes';

import { usePrimeTransferSaveCustomServer } from './hooks/usePrimeTransferSaveCustomServer';

function ServerConfigContent() {
  const intl = useIntl();
  const [serverType, setServerType] = useState<EPrimeTransferServerType>(
    EPrimeTransferServerType.OFFICIAL,
  );
  const [customServer, setCustomServer] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const { gtMd } = useMedia();
  const customServerTrimmed = useMemo(
    () => customServer?.trim()?.replace(/\/+$/, '') || '',
    [customServer],
  );

  useEffect(() => {
    const loadInitialValues = async () => {
      try {
        const config =
          await backgroundApiProxy.simpleDb.primeTransfer.getServerConfig();
        setServerType(config.serverType);
        setCustomServer(config.customServerUrl || '');
      } catch (error) {
        console.warn('Failed to load server config from simpleDB:', error);
      } finally {
        setIsLoading(false);
      }
    };
    void loadInitialValues();
  }, []);

  const saveCustomServerConfig = usePrimeTransferSaveCustomServer();

  const handleSubmit = async () => {
    await saveCustomServerConfig({
      customServerTrimmed,
      serverType,
      setCustomServer,
    });
  };

  const radioOptions = useMemo(() => {
    return [
      {
        label: intl.formatMessage({
          id: ETranslations.transfer_transfer_server_server_official,
        }),
        value: EPrimeTransferServerType.OFFICIAL,
        children: (
          <SizableText size="$bodyMd" color="$textSubdued" pt="$0.5">
            {intl.formatMessage({
              id: ETranslations.transfer_transfer_server_server_official_description,
            })}
          </SizableText>
        ),
      },
      {
        label: intl.formatMessage({
          id: ETranslations.transfer_transfer_server_server_custom,
        }),
        value: EPrimeTransferServerType.CUSTOM,
        children: (
          <YStack gap="$2" pt="$0.5">
            <HyperlinkText
              size="$bodyMd"
              color="$textSubdued"
              translationId={
                ETranslations.transfer_transfer_server_server_custom_description
              }
            />
            {serverType === EPrimeTransferServerType.CUSTOM && !isLoading ? (
              <Input
                autoFocus
                size={gtMd ? 'medium' : 'large'}
                placeholder={intl.formatMessage({
                  id: ETranslations.transfer_transfer_server_server_custom_placeholder,
                })}
                value={customServer}
                onChangeText={setCustomServer}
                addOns={[
                  buildChangeHistoryInputAddon({
                    changeHistoryInfo: {
                      entityId: 'server',
                      entityType: EChangeHistoryEntityType.PrimeTransfer,
                      contentType: EChangeHistoryContentType.ServerUrl,
                    },
                    onChange: setCustomServer,
                  }),
                ]}
              />
            ) : null}
          </YStack>
        ),
      },
    ];
  }, [customServer, intl, serverType, isLoading, gtMd]);

  if (isLoading) {
    return (
      <YStack gap="$4" p="$4" alignItems="center">
        <SizableText>Loading...</SizableText>
      </YStack>
    );
  }

  return (
    <YStack gap="$4">
      <Radio
        value={serverType}
        onChange={(value) => setServerType(value as EPrimeTransferServerType)}
        options={radioOptions}
      />

      <Dialog.Footer
        onConfirm={handleSubmit}
        onConfirmText={intl.formatMessage({
          id: ETranslations.global_confirm,
        })}
        confirmButtonProps={{
          disabled:
            serverType === EPrimeTransferServerType.CUSTOM &&
            !customServerTrimmed,
        }}
        onCancelText={intl.formatMessage({
          id: ETranslations.global_cancel,
        })}
      />
    </YStack>
  );
}

export function showPrimeTransferServerConfigDialog() {
  return Dialog.show({
    isAsync: true,
    title: appLocale.intl.formatMessage({
      id: ETranslations.transfer_transfer_server_server_configuration,
    }),
    icon: 'ServerOutline',
    renderContent: <ServerConfigContent />,
    showFooter: false,
  });
}
