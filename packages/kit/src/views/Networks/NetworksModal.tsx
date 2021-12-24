import React, {
  FC,
  ReactElement,
  cloneElement,
  useCallback,
  useMemo,
  useState,
} from 'react';

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

type NetworksProps = { trigger?: ReactElement<any> };

const Networks: FC<NetworksProps> = ({ trigger }) => {
  const [open, setOpen] = useState(false);
  const [alertOpened, setAlertOpened] = useState(false);
  const [changed] = useState(true);
  const [editable, setEditable] = useState(false);
  const children = editable ? <EditableView /> : <DisplayView />;

  const onPrepareClose = useCallback(() => {
    if (changed) {
      setAlertOpened(true);
    } else {
      setOpen(false);
    }
  }, [changed]);
  const onOpen = useCallback(() => setOpen(true), []);
  const onCloseAlert = useCallback(() => setAlertOpened(false), []);
  const onCloseModal = useCallback(() => setOpen(false), []);

  const onToggle = useCallback(() => {
    if (editable) {
      Toast.show({ title: 'Change Saved' });
    }
    setEditable(!editable);
  }, [editable]);

  const elem = useMemo(() => {
    if (!trigger) return undefined;
    return cloneElement(trigger, { onPress: onOpen });
  }, [trigger, onOpen]);
  return (
    <>
      <Modal
        visible={open}
        header="Customize Networks"
        trigger={elem}
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
