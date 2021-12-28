import React, { FC, useCallback, useState } from 'react';

import { Toast } from 'native-base';

import { Box, Button, Divider, Modal } from '@onekeyhq/components';

import { DiscardAlert } from './DiscardAlert';
import { DisplayView } from './DisplayView';
import { EditableView } from './EditableView';

type ModalFooterProps = { editable?: boolean; onToggle?: () => void };
const ModalFooter: FC<ModalFooterProps> = ({ editable, onToggle }) => (
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
          Done
        </Button>
      ) : (
        <Button ml="3" minW="120px" onPress={onToggle}>
          Edit
        </Button>
      )}
    </Box>
  </Box>
);

type NetworksProps = { opened: boolean; onClose: () => void };

const Networks: FC<NetworksProps> = ({ opened, onClose }) => {
  // const [open, setOpen] = useState(false);
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
  }, [changed]);

  const onCloseAlert = useCallback(() => setAlertOpened(false), []);
  const onCloseModal = useCallback(() => onClose(), []);

  const onToggle = useCallback(() => {
    if (editable) {
      Toast.show({ title: 'Change Saved' });
    }
    setEditable(!editable);
  }, [editable]);

  return (
    <>
      <Modal
        visible={opened}
        header="Customize Networks"
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
