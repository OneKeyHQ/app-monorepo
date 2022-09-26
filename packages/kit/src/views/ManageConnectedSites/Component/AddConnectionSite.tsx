import React, { FC, useState } from 'react';

import { useIntl } from 'react-intl';

import { Button, Dialog, Input, Text, useToast } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';

import walletConnectUtils from '../../../components/WalletConnect/walletConnectUtils';
import { useActiveWalletAccount } from '../../../hooks';
import { useClipboard } from '../../../hooks/useClipboard';
import { AddConnectionSideDialogProps } from '../types';

const AddConnectionSiteDialog: FC<AddConnectionSideDialogProps> = ({
  closeOverlay,
}) => {
  const [inputDappUrl, setInputDappUrl] = useState('');
  const intl = useIntl();
  const handleInputChange = (value: string) => {
    setInputDappUrl(value);
  };
  const { getClipboard, canGetClipboard } = useClipboard();
  const { networkImpl } = useActiveWalletAccount();
  const toast = useToast();
  return (
    <Dialog
      visible
      onClose={closeOverlay}
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
              if (hostname.includes('.')) {
                const existsAccounts =
                  await backgroundApiProxy.serviceDapp.getActiveConnectedAccountsAsync(
                    {
                      origin,
                      impl: networkImpl,
                    },
                  );
                if (!existsAccounts?.length) {
                  backgroundApiProxy.serviceDapp.openConnectionModal({
                    origin,
                  });
                } else {
                  toast.show({
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
          closeOverlay();
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
            width="full"
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
