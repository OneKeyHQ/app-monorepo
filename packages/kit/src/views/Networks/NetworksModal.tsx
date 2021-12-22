import React, { FC, ReactElement, useState } from 'react';

import { Box, Button, Divider, Modal } from '@onekeyhq/components';

import DisplayView from './DisplayView';
import EditableView from './EditableView';

type NetworksProps = { trigger?: ReactElement<any> };

const Networks: FC<NetworksProps> = ({ trigger }) => {
  const [isEdit, setIsEdit] = useState(false);
  const footer = (
    <Box height="70px">
      <Divider />
      <Box
        py="4"
        px="6"
        display="flex"
        flexDirection="row-reverse"
        alignItems="center"
      >
        {!isEdit ? (
          <Button
            ml="3"
            minW="120px"
            onPress={() => {
              setIsEdit(true);
            }}
          >
            Edit
          </Button>
        ) : (
          <Button
            type="primary"
            minW="120px"
            onPress={() => {
              setIsEdit(false);
            }}
          >
            Done
          </Button>
        )}
      </Box>
    </Box>
  );
  const children = isEdit ? <EditableView /> : <DisplayView />;
  return (
    <Modal header="Customize Networks" trigger={trigger} footer={footer}>
      {children}
    </Modal>
  );
};

export default Networks;
