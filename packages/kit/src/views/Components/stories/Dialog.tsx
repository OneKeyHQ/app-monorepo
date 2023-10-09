import { useState } from 'react';

import { Input } from 'tamagui';

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
          </YStack>
        ),
      },
      {
        title: 'Dialog Form',
        element: (
          <YStack>
            <Button
              mt="$4"
              onPress={() =>
                Dialog.confirm({
                  title: 'Password',
                  description: 'input password',
                  renderContent: (
                    <Dialog.Form
                      useFormProps={
                        {
                          defaultValues: {
                            name: 'Nate Wienert',
                            length: '1234567',
                          },
                        } as any
                      }
                    >
                      <Dialog.FormField label="Name" name="name">
                        <Input flex={1} />
                      </Dialog.FormField>
                      <Dialog.FormField
                        label="MaxLength"
                        name="length"
                        rules={{
                          maxLength: { value: 6, message: 'maxLength is 6' },
                        }}
                      >
                        <Input placeholder="Max Length Limit" />
                      </Dialog.FormField>
                      <Dialog.FormField
                        label="Required"
                        name="required"
                        rules={{
                          required: {
                            value: true,
                            message: 'requied input text',
                          },
                        }}
                      >
                        <Input placeholder="Required" />
                      </Dialog.FormField>
                    </Dialog.Form>
                  ),
                  onConfirm: async ({ form }) => {
                    if (form) {
                      const isValid = await form.trigger();
                      if (isValid) {
                        alert(JSON.stringify(form.getValues()));
                      } else {
                        alert('请检查输入项');
                      }
                      return isValid;
                    }
                    return false;
                  },
                })
              }
            >
              <Button.Text>Open Dialog Form</Button.Text>
            </Button>
          </YStack>
        ),
      },
    ]}
  />
);

export default DialogGallery;
