import type { FC } from 'react';
import { useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  Dialog,
  Input,
  Text,
  ToastManager,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';

import walletConnectUtils from '../../../components/WalletConnect/utils/walletConnectUtils';
import { useActiveWalletAccount } from '../../../hooks';
import { useClipboard } from '../../../hooks/useClipboard';

import type { AddConnectionSideDialogProps } from '../types';

const AddConnectionSiteDialog: FC<AddConnectionSideDialogProps> = ({
  onClose,
}) => {
  const [inputDappUrl, setInputDappUrl] = useState('');
  const intl = useIntl();
  const handleInputChange = (value: string) => {
    setInputDappUrl(value);
  };
  const { getClipboard, canGetClipboard } = useClipboard();
  const { networkImpl } = useActiveWalletAccount();

  return (
    <Dialog
      visible
      onClose={onClose}
      footerButtonProps={{
        primaryActionTranslationId: 'action__add',
        primaryActionProps: { type: 'primary' },
        onPrimaryActionPress: async () => {
          let inputText = inputDappUrl.trim();
          if (/^wc:.+@.+\?.+/.test(inputText)) {
            walletConnectUtils.openConnectToDappModal({
              uri: inputText,
            });
          } else if (inputText.length > 0) {
            if (
              !inputText.startsWith('http://') &&
              !inputText.startsWith('https://')
            ) {
              inputText = `https://${inputText}`;
            }
            try {
              const { hostname, origin } = new URL(inputText);
              if (hostname.includes('.') || hostname.includes('localhost')) {
                const existsAccounts =
                  await backgroundApiProxy.serviceDapp.getActiveConnectedAccountsAsync(
                    {
                      origin,
                      impl: networkImpl,
                    },
                  );
                if (!existsAccounts?.length) {
                  // use setTimeout fix android platform onpenModal ANR
                  setTimeout(async () => {
                    await backgroundApiProxy.serviceDapp.openConnectionModal({
                      origin,
                    });
                  }, 600);
                } else {
                  ToastManager.show({
                    title: intl.formatMessage({
                      id: 'msg__this_address_already_exists',
                    }),
                  });
                }
              }
            } catch {
              //
            }
          }
          onClose?.();
        },
      }}
      contentProps={{
        title: intl.formatMessage({ id: 'title__add_site_connection' }),
        contentElement: (
          <Input
            rightCustomElement={
              canGetClipboard ? (
                <Button
                  type="plain"
                  onPress={async () => {
                    const t = await getClipboard();
                    if (t) {
                      setInputDappUrl(t);
                    }
                  }}
                >
                  <Text color="text-success">
                    {intl.formatMessage({ id: 'action__paste' })}
                  </Text>
                </Button>
              ) : null
            }
            autoFocus
            w="full"
            mt="2"
            type="text"
            placeholder={intl.formatMessage({
              id: 'form__start_with_wc_or_https_placeholder',
            })}
            value={inputDappUrl}
            onChangeText={handleInputChange}
          />
        ),
      }}
    />
  );
};

export default AddConnectionSiteDialog;
