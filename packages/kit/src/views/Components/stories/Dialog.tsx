import { useState } from 'react';

import { Icon } from 'native-base';

import {
  Box,
  Button,
  Center,
  Dialog,
  Stack,
  Typography,
} from '@onekeyhq/components';
import type { OnCloseCallback } from '@onekeyhq/components/src/Dialog/components/FooterButton';
import { Metamask } from '@onekeyhq/components/src/Icon/react/illus';

import { showDialog } from '../../../utils/overlayUtils';

const Modal1 = () => {
  const [visible, setVisible] = useState(false);
  return (
    <Box>
      <Button type="primary" onPress={() => setVisible(!visible)}>
        弹窗 1
      </Button>
      <Dialog
        visible={visible}
        contentProps={{
          iconType: 'danger',
          title: 'Danger',
          content: '操作过程出现了严重错误，请联系客服寻求帮助。',
        }}
        footerButtonProps={{
          onPrimaryActionPress: ({ onClose }: OnCloseCallback) => {
            onClose?.();
            console.log('点击 弹窗1 的主按钮');
          },
          onSecondaryActionPress: () => {
            console.log('点击 弹窗1 的副按钮');
          },
          primaryActionProps: {
            type: 'outline',
          },
        }}
        onClose={() => setVisible(!visible)}
      />
    </Box>
  );
};

const Modal2 = () => (
  <Dialog
    trigger={<Button>弹窗 2（使用 trigger 属性控制）</Button>}
    contentProps={{
      iconType: 'danger',
      title: 'Danger',
      content: '操作过程出现了严重错误，请联系客服寻求帮助。',
    }}
  />
);

const Modal3 = () => (
  <Dialog
    trigger={<Button>弹窗 3（无 Icon、单 Button）</Button>}
    contentProps={{
      title: 'Danger',
      content: '操作过程出现了严重错误，请联系客服寻求帮助。',
    }}
    footerButtonProps={{
      hidePrimaryAction: true,
    }}
  />
);

const Modal4 = () => (
  <Dialog
    trigger={<Button>弹窗 4（无 Button）</Button>}
    contentProps={{
      title: 'Danger',
      content: '操作过程出现了严重错误，请联系客服寻求帮助。',
    }}
    footerButtonProps={{
      hidePrimaryAction: true,
      hideSecondaryAction: true,
    }}
  />
);

const Modal5 = () => (
  <Dialog
    canceledOnTouchOutside={false}
    trigger={<Button>弹窗 5（自定义 Icon、触摸 Dialog 外部无法关闭）</Button>}
    contentProps={{
      icon: <Icon as={Metamask} />,
      title: 'Danger',
      content: '操作过程出现了严重错误，请联系客服寻求帮助。',
    }}
  />
);

const Modal6 = () => {
  const [visible, setVisible] = useState(false);
  return (
    <Box>
      <Button type="primary" onPress={() => setVisible(!visible)}>
        弹窗 6（自定义内容)
      </Button>

      <Dialog
        visible={visible}
        contentProps={{
          icon: <Icon as={Metamask} />,
          title: 'Danger',
          content: '操作过程出现了严重错误，请联系客服寻求帮助。',
        }}
        onClose={() => {
          setVisible(false);
        }}
      >
        <Box flexDirection="column" alignItems="center">
          <Icon as={Metamask} />
          <Typography.Heading mt={2} color="text-default">
            "自定义标题"
          </Typography.Heading>
          <Typography.Body1 textAlign="center" color="text-subdued">
            "我是自定义内容"
          </Typography.Body1>
          <Button
            mt={4}
            type="primary"
            onPress={() => {
              setVisible(!visible);
            }}
          >
            关闭
          </Button>
        </Box>
      </Dialog>
    </Box>
  );
};

const Modal7 = () => {
  const [visible, setVisible] = useState(false);
  return (
    <Box>
      <Button type="primary" onPress={() => setVisible(!visible)}>
        弹窗 7（自定义文字内容)
      </Button>

      <Dialog
        visible={visible}
        contentProps={{
          icon: <Icon as={Metamask} />,
          title: 'Danger',
          content: '操作过程出现了严重错误，请联系客服寻求帮助。',
        }}
        onClose={() => {
          setVisible(false);
        }}
      >
        <Box
          flexDirection="column"
          borderRadius="12px"
          bg="surface-neutral-subdued"
          alignItems="center"
          p={2.5}
        >
          <Typography.Caption textAlign="center" color="text-subdued">
            Slot, detach component or replace your local component with this
            slot
          </Typography.Caption>
        </Box>
      </Dialog>
    </Box>
  );
};

/**
 * showDialog 会注入 onClose 方法，务必传入并使用才可关闭容器
 * Dialog 保证 visible 即可，容器会动态挂载此 Dialog
 *
 */
function ShowDialogExample({ onClose }: { onClose?: () => void }) {
  return (
    <Dialog
      visible
      contentProps={{
        iconType: 'danger',
        title: 'Danger',
        content: '操作过程出现了严重错误，请联系客服寻求帮助。',
      }}
      footerButtonProps={{
        onPrimaryActionPress: () => {
          onClose?.();
          console.log('点击 弹窗1 的主按钮');
        },
        onSecondaryActionPress: () => {
          console.log('点击 弹窗1 的副按钮');
        },
        primaryActionProps: {
          type: 'outline',
        },
      }}
    />
  );
}

const Modal8 = () => (
  <Button
    onPress={() => {
      showDialog(<ShowDialogExample />);
    }}
  >
    showDialog 打开
  </Button>
);

const DialogGallery = () => (
  <Center flex="1" bg="background-hovered">
    <Stack
      direction={{
        base: 'column',
      }}
      space={2}
    >
      <Modal1 />
      <Modal2 />
      <Modal3 />
      <Modal4 />
      <Modal5 />
      <Modal6 />
      <Modal7 />
      <Modal8 />
    </Stack>
  </Center>
);

export default DialogGallery;
