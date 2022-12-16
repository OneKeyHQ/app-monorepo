import { useIntl } from 'react-intl';

import { Alert, Center, Modal, Text, VStack } from '@onekeyhq/components';
import type { IDappSourceInfo } from '@onekeyhq/shared/types';

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
      hidePrimaryAction
      secondaryActionTranslationId="action__cancel"
      onSecondaryActionPress={({ close }) => {
        dappApprove.reject();
        close();
      }}
      onModalClose={dappApprove.reject}
    >
      <Center flex={1}>
        <VStack alignItems="center" mb={4}>
          <Text>{sourceInfo?.origin || ''}</Text>
          <Text fontWeight="bold">{sourceInfo?.scope || ''}</Text>
        </VStack>
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
