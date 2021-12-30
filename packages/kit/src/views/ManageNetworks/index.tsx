import React, { FC, useCallback, useState } from 'react';

import { Toast } from 'native-base';
import { useIntl } from 'react-intl';

import { Box, Button, Divider, Modal } from '@onekeyhq/components';

import { DiscardAlert } from './DiscardAlert';
import { DisplayView } from './DisplayView';
import { EditableView } from './EditableView';

type ModalFooterProps = { editable?: boolean; onToggle?: () => void };
const ModalFooter: FC<ModalFooterProps> = ({ editable, onToggle }) => {
  const intl = useIntl();
  return (
    <Box height="70px">
      <Divider />
      <Box
        py="4"
        px="6"
        display="flex"
        flexDirection="row-reverse"
        alignItems="center"
      >
        {editable ? (
          <Button type="primary" minW="120px" onPress={onToggle}>
            {intl.formatMessage({ id: 'action__done', defaultMessage: 'Done' })}
          </Button>
        ) : (
          <Button ml="3" minW="120px" onPress={onToggle}>
            {intl.formatMessage({ id: 'action__edit', defaultMessage: 'Edit' })}
          </Button>
        )}
      </Box>
    </Box>
  );
};

type NetworksProps = { opened: boolean; onClose: () => void };

const Networks: FC<NetworksProps> = ({ opened, onClose }) => {
  const intl = useIntl();
  const [alertOpened, setAlertOpened] = useState(false);
  const [changed] = useState(true);
  const [editable, setEditable] = useState(false);
  const children = editable ? <EditableView /> : <DisplayView />;

  const onPrepareClose = useCallback(() => {
    if (changed) {
      setAlertOpened(true);
    } else {
      onClose();
    }
  }, [changed, onClose]);

  const onCloseAlert = useCallback(() => setAlertOpened(false), []);
  const onCloseModal = useCallback(() => onClose(), [onClose]);

  const onToggle = useCallback(() => {
    if (editable) {
      Toast.show({
        title: intl.formatMessage({
          id: 'msg__change_saved',
          defaultMessage: 'Change saved!',
        }),
      });
    }
    setEditable(!editable);
  }, [editable, intl]);

  return (
    <>
      <Modal
        visible={opened}
        header={intl.formatMessage({ id: 'action__customize_network' })}
        onClose={onPrepareClose}
        footer={<ModalFooter editable={editable} onToggle={onToggle} />}
      >
        {children}
      </Modal>
      <DiscardAlert
        visible={alertOpened}
        onConfirm={onCloseModal}
        onClose={onCloseAlert}
      />
    </>
  );
};

export default Networks;
