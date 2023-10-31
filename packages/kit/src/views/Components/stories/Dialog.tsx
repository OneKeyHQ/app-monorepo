import type { ReactNode } from 'react';
import { useState } from 'react';

import {
  Adapt as TMAdapt,
  Dialog as TMDialog,
  Sheet as TMSheet,
} from 'tamagui';

import type { DialogProps } from '@onekeyhq/components';
import {
  Button,
  Dialog,
  Input,
  Text,
  TextArea,
  XStack,
  YStack,
} from '@onekeyhq/components';

import { Layout } from './utils/Layout';

import type { UseFormReturn } from 'react-hook-form';

function DialogInstance() {
  const [open, setOpen] = useState(false);
  const [show, setShow] = useState(false);

  return (
    <TMDialog
      modal
      onOpenChange={() => {
        setOpen(open);
      }}
    >
      <TMDialog.Trigger asChild>
        <Button>Show TMDialog</Button>
      </TMDialog.Trigger>

      <TMAdapt when="md">
        <TMSheet
          animation="quick"
          zIndex={200000}
          modal
          dismissOnSnapToBottom
          snapPointsMode="fit"
        >
          <TMSheet.Frame padding="$4" gap="$4">
            <TMAdapt.Contents />
          </TMSheet.Frame>
          <TMSheet.Overlay
            animation="quick"
            enterStyle={{ opacity: 0 }}
            exitStyle={{ opacity: 0 }}
          />
        </TMSheet>
      </TMAdapt>

      <TMDialog.Portal>
        <TMDialog.Overlay
          key="overlay"
          animation="quick"
          opacity={0.5}
          enterStyle={{ opacity: 0 }}
          exitStyle={{ opacity: 0 }}
        />

        <TMDialog.Content
          bordered
          elevate
          key="content"
          animateOnly={['transform', 'opacity']}
          animation={[
            'quick',
            {
              opacity: {
                overshootClamping: true,
              },
            },
          ]}
          enterStyle={{ x: 0, y: -20, opacity: 0, scale: 0.9 }}
          exitStyle={{ x: 0, y: 10, opacity: 0, scale: 0.95 }}
          gap="$4"
        >
          <TMDialog.Title>Edit profile</TMDialog.Title>
          <TMDialog.Description>
            Make changes to your profile here. Click save when you're done.
          </TMDialog.Description>
          <Button
            onPress={() => {
              setShow(!show);
            }}
          >
            Show
          </Button>
          {show && <Text>hiddenContent</Text>}
        </TMDialog.Content>
      </TMDialog.Portal>
    </TMDialog>
  );
}

const VariantsDemo = ({ tone }: DialogProps) => {
  const [isOpen, changeIsOpen] = useState(false);
  return (
    <Dialog
      open={isOpen}
      icon="PlaceholderOutline"
      title="Lorem ipsum"
      description="Lorem ipsum dolor sit amet consectetur. Nisi in arcu ultrices neque vel nec."
      onOpen={() => {
        changeIsOpen(true);
      }}
      renderTrigger={<Button>{tone || 'Default'}</Button>}
      onClose={() => {
        changeIsOpen(false);
      }}
      tone={tone}
    />
  );
};

const ControlledDialogByTextOnButton = () => {
  const [isOpen, changeIsOpen] = useState(false);
  return (
    <Dialog
      open={isOpen}
      title="Lorem ipsum"
      description="Lorem ipsum dolor sit amet consectetur. Nisi in arcu ultrices neque vel nec."
      onOpen={() => {
        changeIsOpen(true);
      }}
      renderTrigger={<Button>Trigger</Button>}
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
          Trigger
        </Button>
      }
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
      <Button onPress={() => changeIsOpen(true)}>Trigger</Button>
      <Dialog
        title="Lorem ipsum"
        description="Lorem ipsum dolor sit amet consectetur. Nisi in arcu ultrices neque vel nec."
        open={isOpen}
        onClose={() => {
          changeIsOpen(false);
        }}
      />
    </>
  );
};

const HideFooterDialog = () => {
  const [isOpen, changeIsOpen] = useState(false);
  return (
    <>
      <Button onPress={() => changeIsOpen(true)}>Trigger</Button>
      <Dialog
        title="Lorem ipsum"
        description="Lorem ipsum dolor sit amet consectetur. Nisi in arcu ultrices neque vel nec."
        open={isOpen}
        onClose={() => {
          changeIsOpen(false);
        }}
        showFooter={false}
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
        title: 'TM',
        element: <DialogInstance />,
      },
      {
        title: 'Variants',
        element: (
          <XStack space="$4">
            <VariantsDemo />
            <VariantsDemo tone="destructive" />
          </XStack>
        ),
      },
      {
        title: 'Button as value of renderTrigger',
        element: <ControlledDialogByTextOnButton />,
      },
      {
        title: 'Button with onPress as value of renderTrigger',
        element: <ControlledDialogByTextOnButtonWithOnPress />,
      },
      {
        title: 'Button as trigger',
        element: <ControlledDialogByButton />,
      },
      {
        title: 'Hide dialog footer',
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
                      useFormProps={{
                        defaultValues: {
                          name: 'Nate Wienert',
                          length: '1234567',
                        },
                      }}
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
        title: 'Dialog Form with Form Context & Focus by Code',
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
                      useFormProps={{
                        defaultValues: {
                          name: 'Nate Wienert',
                          input: '1234567',
                          textArea: 'textArea',
                        },
                      }}
                    >
                      {
                        // eslint-disable-next-line react/no-unstable-nested-components
                        (({
                          form,
                        }: {
                          form: UseFormReturn<{
                            name: string;
                            length: string;
                            input: string;
                            textArea: string;
                          }>;
                        }) => (
                          <>
                            <Dialog.FormField label="Name" name="name">
                              <Input flex={1} />
                            </Dialog.FormField>
                            <Dialog.FormField
                              label="MaxLength"
                              name="input"
                              rules={{
                                maxLength: {
                                  value: 6,
                                  message: 'maxLength is 6',
                                },
                              }}
                            >
                              <Input
                                placeholder="Max Length Limit"
                                selectTextOnFocus
                              />
                            </Dialog.FormField>
                            <Dialog.FormField label="textArea" name="textArea">
                              <TextArea placeholder="type something random" />
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
                            <Button
                              marginVertical="$6"
                              onPress={() => {
                                form.setFocus('input');
                              }}
                            >
                              Focus MaxLength Input
                            </Button>
                            <Button
                              marginVertical="$6"
                              onPress={() => {
                                form.setFocus('textArea');
                              }}
                            >
                              Focus TextArea
                            </Button>
                          </>
                        )) as unknown as ReactNode
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
              Open Dialog Form with Form Context & Focus by Code
            </Button>
          </YStack>
        ),
      },
      {
        title: 'Dialog Form With Form & AutoFocus Input',
        element: (
          <YStack>
            <Button
              mt="$4"
              onPress={() =>
                Dialog.confirm({
                  title: 'Password',
                  description: 'input password',
                  renderContent: (
                    <Dialog.Form>
                      <Dialog.FormField label="Name" name="name">
                        <Input
                          autoFocus
                          flex={1}
                          placeholder="only numeric value"
                        />
                      </Dialog.FormField>
                    </Dialog.Form>
                  ),
                  onConfirm: () => {},
                })
              }
            >
              Open Dialog Form
            </Button>
          </YStack>
        ),
      },
      {
        title: '命令式 API, Close Dialog ',
        element: (
          <YStack>
            <Button
              mt="$4"
              onPress={() => {
                const dialog = Dialog.confirm({
                  title: '1500ms',
                  renderContent: (
                    <Dialog.Form>
                      <Dialog.FormField label="Name" name="name">
                        <Input
                          autoFocus
                          flex={1}
                          placeholder="only numeric value"
                        />
                      </Dialog.FormField>
                    </Dialog.Form>
                  ),
                  onConfirm: () => {},
                });
                setTimeout(() => {
                  dialog.close();
                }, 1500);
              }}
            >
              Close Dialog!
            </Button>
          </YStack>
        ),
      },
    ]}
  />
);

export default DialogGallery;
