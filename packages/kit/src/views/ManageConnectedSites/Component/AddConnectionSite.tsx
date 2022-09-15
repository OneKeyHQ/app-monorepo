import React, { FC, useState } from 'react';

import { useIntl } from 'react-intl';

import { Box, Dialog, Input } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';

import walletConnectUtils from '../../../components/WalletConnect/walletConnectUtils';
import { AddConnectionSideDialogProps } from '../types';

const AddConnectionSiteDialog: FC<AddConnectionSideDialogProps> = ({
  closeOverlay,
}) => {
  const [inputDappUrl, setInputDappUrl] = useState('');
  const intl = useIntl();
  const handleInputChange = (value: string) => {
    setInputDappUrl(value);
  };
  return (
    <Dialog
      visible
      onClose={closeOverlay}
      footerButtonProps={{
        primaryActionTranslationId: 'action__add',
        primaryActionProps: { type: 'primary' },
        onPrimaryActionPress: () => {
          let origin = inputDappUrl.trim();
          if (/^wc:.+@.+\?.+/.test(origin)) {
            walletConnectUtils.openConnectToDappModal({
              uri: origin,
            });
          } else if (origin.length > 0) {
            if (
              !origin.startsWith('http://') &&
              !origin.startsWith('https://')
            ) {
              origin = `https://${origin}`;
            }
            try {
              const testUrl = new URL(origin);
              if (testUrl.hostname.includes('.')) {
                backgroundApiProxy.serviceDapp.openConnectionModal({ origin });
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
