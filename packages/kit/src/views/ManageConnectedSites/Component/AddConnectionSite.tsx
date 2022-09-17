import React, { FC, useState } from 'react';

import { useIntl } from 'react-intl';

import { Box, Dialog, Input, useToast } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';

import walletConnectUtils from '../../../components/WalletConnect/walletConnectUtils';
import { useActiveWalletAccount } from '../../../hooks';
import { AddConnectionSideDialogProps } from '../types';

const AddConnectionSiteDialog: FC<AddConnectionSideDialogProps> = ({
  closeOverlay,
}) => {
  const [inputDappUrl, setInputDappUrl] = useState('');
  const intl = useIntl();
  const handleInputChange = (value: string) => {
    setInputDappUrl(value);
  };
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
          <Box width="full" mt="4">
            <Input
              autoFocus
              width="full"
              type="text"
              placeholder="https://example.com"
              onChangeText={handleInputChange}
            />
          </Box>
        ),
      }}
    />
  );
};

export default AddConnectionSiteDialog;
