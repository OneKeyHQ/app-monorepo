import React, { FC, ReactElement, useState } from 'react';

import { useIntl } from 'react-intl';

import { Box, Modal, SegmentedControl } from '@onekeyhq/components';

import KeyStoreForm from './KeyStoreForm';
import PrivateKeyForm from './PrivateKeyForm';

type ImportedAccountProps = {
  trigger: ReactElement<any>;
};

const ImportedAccount: FC<ImportedAccountProps> = ({ trigger }) => {
  const intl = useIntl();
  const [activeSegment, setActiveSegment] = useState('privateKey');
  return (
    <Modal
      hideSecondaryAction
      trigger={trigger}
      header={intl.formatMessage({ id: 'wallet__imported_accounts' })}
      primaryActionTranslationId="action__import"
      onPrimaryActionPress={({ onClose }) => onClose?.()}
    >
      <Box mb="4" w="full">
        <SegmentedControl
          containerProps={{
            width: '100%',
          }}
          defaultValue={activeSegment}
          onChange={setActiveSegment}
          options={[
            {
              label: intl.formatMessage({ id: 'form__private_key' }),
              value: 'privateKey',
            },
            {
              label: intl.formatMessage({ id: 'form__keystore' }),
              value: 'keystore',
            },
          ]}
        />
      </Box>
      {activeSegment === 'privateKey' && <PrivateKeyForm />}
      {activeSegment === 'keystore' && <KeyStoreForm />}
    </Modal>
  );
};

export default ImportedAccount;
