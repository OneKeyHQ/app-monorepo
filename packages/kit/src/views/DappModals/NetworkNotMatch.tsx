import React from 'react';

import { useIntl } from 'react-intl';

import { Alert, Center, Modal } from '@onekeyhq/components';

import { IDappSourceInfo } from '../../background/IBackgroundApi';
import useDappApproveAction from '../../hooks/useDappApproveAction';
import useDappParams from '../../hooks/useDappParams';

const NetworkNotMatch = () => {
  const intl = useIntl();
  const { sourceInfo } = useDappParams();
  const { id } = sourceInfo ?? ({} as IDappSourceInfo);

  const dappApprove = useDappApproveAction({
    id,
    closeOnError: true,
  });

  return (
    <Modal
      primaryActionTranslationId="action__confirm"
      primaryActionProps={{ isDisabled: true }}
      secondaryActionTranslationId="action__reject"
      onSecondaryActionPress={({ close }) => {
        dappApprove.reject();
        close();
      }}
    >
      <Center flex={1}>
        <Alert
          title={intl.formatMessage({ id: 'msg__mismatched_networks' })}
          alertType="error"
          dismiss={false}
        />
      </Center>
    </Modal>
  );
};

export default NetworkNotMatch;
