import React from 'react';

import { useIntl } from 'react-intl';

import { Alert, Box, Center, Modal, Text } from '@onekeyhq/components';

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

  // TODO define <DappModal /> trigger onModalClose() on gesture close
  return (
    <Modal
      primaryActionTranslationId="action__confirm"
      primaryActionProps={{ isDisabled: true }}
      secondaryActionTranslationId="action__reject"
      onSecondaryActionPress={({ close }) => {
        dappApprove.reject();
        close();
      }}
      onModalClose={dappApprove.reject}
    >
      <Center flex={1}>
        <Box mb={4}>
          <Text>{sourceInfo?.origin || ''}</Text>
        </Box>
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
