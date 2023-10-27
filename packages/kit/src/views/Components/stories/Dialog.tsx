import type { ReactNode } from 'react';
import { useState } from 'react';

import { Input } from 'tamagui';

import { Button, Dialog, Text, YStack } from '@onekeyhq/components';

import { Layout } from './utils/Layout';

import type { UseFormReturn } from 'react-hook-form';

const ControlledDialogByText = () => {
  const [isOpen, changeIsOpen] = useState(false);
  return (
    <Dialog
      backdrop
      open={isOpen}
      title="Lorem ipsum"
      description="Lorem ipsum dolor sit amet consectetur. Nisi in arcu ultrices neque vel nec."
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

const ControlledDialogByTextOnButton = () => {
  const [isOpen, changeIsOpen] = useState(false);
  return (
    <Dialog
      backdrop
      open={isOpen}
      title="Lorem ipsum"
      description="Lorem ipsum dolor sit amet consectetur. Nisi in arcu ultrices neque vel nec."
      onOpen={() => {
        changeIsOpen(true);
      }}
      renderTrigger={<Button>Trigger Modal by Button</Button>}
      renderContent={<Text>Overlay Content by Text Trigger</Text>}
      onClose={() => {
        changeIsOpen(false);
      }}
    />
  );
};

const ControlledDialogByTextOnButtonWithOnPress = () => {
  const [isOpen, changeIsOpen] = useState(false);
  return (
    <Dialog
      backdrop
      open={isOpen}
      title="Lorem ipsum"
      description="Lorem ipsum dolor sit amet consectetur. Nisi in arcu ultrices neque vel nec."
      onOpen={() => {
        changeIsOpen(true);
      }}
      renderTrigger={
        <Button
          onPress={() => {
            console.log('trigger');
          }}
        >
          Trigger Modal by Button with onPress Event
        </Button>
      }
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
      <Button onPress={() => changeIsOpen(true)}>Open Modal By Button</Button>
      <Dialog
        backdrop
        title="Lorem ipsum"
        description="Lorem ipsum dolor sit amet consectetur. Nisi in arcu ultrices neque vel nec."
        open={isOpen}
        onClose={() => {
          changeIsOpen(false);
        }}
        renderContent={<Text>Overlay Content by Button Trigger</Text>}
      />
    </>
  );
};

const HideFooterDialog = () => {
  const [isOpen, changeIsOpen] = useState(false);
  return (
    <>
      <Button onPress={() => changeIsOpen(true)}>Hide Footer</Button>
      <Dialog
        backdrop
        title="Lorem ipsum"
        description="Lorem ipsum dolor sit amet consectetur. Nisi in arcu ultrices neque vel nec."
        open={isOpen}
        onClose={() => {
          changeIsOpen(false);
        }}
        renderContent={<Text>Overlay Content by Button Trigger</Text>}
        renderFooter={null}
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
        title: 'open Modal by renderTrigger on Button',
        element: <ControlledDialogByTextOnButton />,
      },
      {
        title: 'open Modal by renderTrigger on Button with onPress event',
        element: <ControlledDialogByTextOnButtonWithOnPress />,
      },
      {
        title: 'open Modal by Button',
        element: <ControlledDialogByButton />,
      },
      {
        title: 'hide footer',
        element: <HideFooterDialog />,
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
                    'Lorem ipsum dolor sit amet consectetur. Nisi in arcu ultrices neque vel nec.',
                  onConfirm() {
                    alert('confirmed');
                  },
                })
              }
            >
              Confirm
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
                    'Lorem ipsum dolor sit amet consectetur. Nisi in arcu ultrices neque vel nec.',
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
              load remote data successfully
            </Button>
            <Button
              mt="$4"
              onPress={() =>
                Dialog.confirm({
                  title: 'Lorem ipsum',
                  description:
                    'Lorem ipsum dolor sit amet consectetur. Nisi in arcu ultrices neque vel nec.',
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
              load remote data failed
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
              Open Dialog Form
            </Button>
          </YStack>
        ),
      },
      {
        title: 'Dialog Form With Form Context',
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
                      {
                        // eslint-disable-next-line react/no-unstable-nested-components
                        (({
                          form,
                        }: {
                          form: UseFormReturn<{
                            name: string;
                            async: string;
                          }>;
                        }) => (
                          <>
                            <Dialog.FormField label="Name" name="name">
                              <Input flex={1} />
                            </Dialog.FormField>
                            <Dialog.FormField
                              label="MaxLength"
                              name="length"
                              rules={{
                                maxLength: {
                                  value: 6,
                                  message: 'maxLength is 6',
                                },
                              }}
                            >
                              <Input placeholder="Max Length Limit" />
                            </Dialog.FormField>
                            <Dialog.FormField
                              label="async load remote data"
                              name="async"
                              rules={{
                                validate: (value: string) =>
                                  new Promise((resolve) => {
                                    setTimeout(() => {
                                      // get form value
                                      console.log(value, form.getValues().name);
                                      resolve(true);
                                    }, 1500);
                                  }),
                              }}
                            >
                              <Input placeholder="Required" />
                            </Dialog.FormField>
                          </>
                        )) as any as ReactNode
                      }
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
              Open Dialog Form
            </Button>
          </YStack>
        ),
      },
    ]}
  />
);

export default DialogGallery;
