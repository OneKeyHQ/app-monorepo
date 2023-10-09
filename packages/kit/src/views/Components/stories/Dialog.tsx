import { useState } from 'react';

import { Button, Dialog, Text, YStack } from '@onekeyhq/components';

import { Layout } from './utils/Layout';

const ControlledDialogByText = () => {
  const [isOpen, changeIsOpen] = useState(false);
  return (
    <Dialog
      backdrop
      open={isOpen}
      title="Lorem ipsum"
      description="Lorem ipsum dolor sit amet consectetur. Nisi in arcu ultrices neque vel nec. Eu quam nulla lectus faucibus senectus interdum iaculis egestas."
      onOpen={() => {
        changeIsOpen(true);
      }}
      renderTrigger={<Text>Open Modal by Text</Text>}
      renderContent={<Text>Overlay Content by Text Trigger</Text>}
      onClose={() => {
        changeIsOpen(false);
      }}
    />
  );
};

const ControlledDialogByButton = () => {
  const [isOpen, changeIsOpen] = useState(false);
  return (
    <>
      <Button onPress={() => changeIsOpen(true)}>
        <Button.Text>Open Modal By Button</Button.Text>
      </Button>
      <Dialog
        backdrop
        title="Lorem ipsum"
        description="Lorem ipsum dolor sit amet consectetur. Nisi in arcu ultrices neque vel nec. Eu quam nulla lectus faucibus senectus interdum iaculis egestas."
        open={isOpen}
        onClose={() => {
          changeIsOpen(false);
        }}
        renderContent={<Text>Overlay Content by Button Trigger</Text>}
      />
    </>
  );
};

const DialogGallery = () => (
  <Layout
    description="需要用户处理事务，又不希望跳转路由以致打断工作流程时，可以使用 Dialog 组件"
    suggestions={[
      'Dialog 的呈现层级高于页面，但低于 Toast',
      '需要避免在 Dialog 显示需要滚动操作的内容',
    ]}
    boundaryConditions={['禁止将 Dialog 作为路由页面使用']}
    elements={[
      {
        title: 'open Modal by renderTrigger',
        element: <ControlledDialogByText />,
      },
      {
        title: 'open Modal by Button',
        element: <ControlledDialogByButton />,
      },
      {
        title: '命令式 API',
        element: (
          <YStack>
            <Button
              onPress={() =>
                Dialog.confirm({
                  title: 'Lorem ipsum',
                  description:
                    'Lorem ipsum dolor sit amet consectetur. Nisi in arcu ultrices neque vel nec. Eu quam nulla lectus faucibus senectus interdum iaculis egestas.',
                  onConfirm() {
                    alert('confirmed');
                  },
                })
              }
            >
              <Button.Text>Confirm</Button.Text>
            </Button>
          </YStack>
        ),
      },
      {
        title: '命令式 API, Confirm Button Loading',
        element: (
          <YStack>
            <Button
              onPress={() =>
                Dialog.confirm({
                  title: 'Lorem ipsum',
                  description:
                    'Lorem ipsum dolor sit amet consectetur. Nisi in arcu ultrices neque vel nec. Eu quam nulla lectus faucibus senectus interdum iaculis egestas.',
                  onConfirm() {
                    return new Promise((resolve) => {
                      setTimeout(() => {
                        alert('loaded successful');
                        resolve(true);
                      }, 3000);
                    });
                  },
                })
              }
            >
              <Button.Text>load remote data successfully</Button.Text>
            </Button>
            <Button
              mt="$4"
              onPress={() =>
                Dialog.confirm({
                  title: 'Lorem ipsum',
                  description:
                    'Lorem ipsum dolor sit amet consectetur. Nisi in arcu ultrices neque vel nec. Eu quam nulla lectus faucibus senectus interdum iaculis egestas.',
                  onConfirm() {
                    return new Promise((resolve) => {
                      setTimeout(() => {
                        alert('loaded failed');
                        resolve(false);
                      }, 3000);
                      return false;
                    });
                  },
                })
              }
            >
              <Button.Text>load remote data failed</Button.Text>
            </Button>
            <Button
              mt="$4"
              onPress={() =>
                Dialog.confirm({
                  title: 'Password',
                  description: 'input password',
                  onConfirm() {
                    return new Promise((resolve) => {
                      setTimeout(() => {
                        alert('loaded failed');
                        resolve(false);
                      }, 3000);
                      return false;
                    });
                  },
                })
              }
            >
              <Button.Text>load remote data failed</Button.Text>
            </Button>
          </YStack>
        ),
      },
    ]}
  />
);

export default DialogGallery;
