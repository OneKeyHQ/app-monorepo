import { useState } from 'react';

import {
  Box,
  Button,
  Center,
  Modal,
  Stack,
  ToastManager,
  Typography,
} from '@onekeyhq/components';

const Modal1 = () => {
  const [visible, setVisible] = useState(false);
  return (
    <Box>
      <Button type="primary" onPress={() => setVisible(!visible)}>
        弹窗 1
      </Button>
      <Modal visible={visible} onClose={() => setVisible(!visible)}>
        <Center flex="1">
          <Typography.Body2>我能吞下玻璃而不伤身体</Typography.Body2>
        </Center>
      </Modal>
    </Box>
  );
};

const Modal2 = () => (
  <Modal trigger={<Button>弹窗 2（使用 trigger 属性控制）</Button>}>
    <Center flex="1">
      <Typography.Body2>我能吞下玻璃而不伤身体</Typography.Body2>
    </Center>
  </Modal>
);

const Modal3 = () => (
  <Modal
    trigger={<Button>弹窗 3</Button>}
    footer={
      <Center height="24px">
        <Typography.Body2>自定义 footer</Typography.Body2>
      </Center>
    }
  >
    <Center flex="1">
      <Typography.Body2>我能吞下玻璃而不伤身体</Typography.Body2>
    </Center>
  </Modal>
);

const Modal4 = () => (
  <Modal
    header="MODAL 4"
    trigger={<Button>弹窗 4</Button>}
    hideSecondaryAction
    onPrimaryActionPress={({ onClose }) => {
      onClose?.();
      ToastManager.show({
        title: '点击了 primary action',
      });
    }}
  >
    <Center flex="1">
      <Typography.Body2>隐藏底部按钮，自定义点击行为</Typography.Body2>
    </Center>
  </Modal>
);

const Modal5 = () => {
  const [visible, setVisible] = useState(false);

  return (
    <>
      <Button onPress={() => setVisible(!visible)}>弹窗 5</Button>
      <Modal
        hideSecondaryAction
        closeable={false}
        header="MODAL 5"
        visible={visible}
        onPrimaryActionPress={({ onClose }) => {
          onClose?.();
          ToastManager.show({
            title: '点击了 primary action',
          });
        }}
      >
        <Center>
          <Typography.Body2 my="2">
            受控的展示与关闭，需手动调用方法进行开关
          </Typography.Body2>
          <Button onPress={() => setVisible(!visible)}>关闭弹窗 5</Button>
        </Center>
      </Modal>
    </>
  );
};

const Modal6 = () => (
  <Modal
    hideSecondaryAction
    header="MODAL 6"
    onClose={() => Math.random() > 0.5}
    trigger={<Button>弹窗 6</Button>}
  >
    <Center>
      <Typography.Body2 my="2">
        关闭按钮通过 onClose 返回值控制，可以关闭前二次确认
      </Typography.Body2>
    </Center>
  </Modal>
);

const ModalGallery = () => (
  <Center flex="1" bg="background-hovered">
    <Stack
      direction={{
        base: 'column',
        md: 'row',
      }}
      space={2}
    >
      <Modal1 />
      <Modal2 />
      <Modal3 />
      <Modal4 />
      <Modal5 />
      <Modal6 />
    </Stack>
  </Center>
);

export default ModalGallery;
