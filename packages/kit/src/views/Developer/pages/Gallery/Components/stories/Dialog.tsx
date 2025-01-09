/* eslint-disable react/no-unstable-nested-components */
import type { ForwardedRef } from 'react';
import { forwardRef, useCallback, useEffect, useState } from 'react';

import type { ICheckedState } from '@onekeyhq/components';
import {
  Button,
  Checkbox,
  Dialog,
  DialogContainer,
  Form,
  Input,
  ScrollView,
  Select,
  SizableText,
  Stack,
  Toast,
  XStack,
  YStack,
  useDialogInstance,
  useForm,
} from '@onekeyhq/components';
import type {
  IDialogContainerProps,
  IDialogInstance,
} from '@onekeyhq/components/src/composite/Dialog/type';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useRouteIsFocused as useIsFocused } from '@onekeyhq/kit/src/hooks/useRouteIsFocused';
import {
  EGalleryRoutes,
  EModalRoutes,
  ETestModalPages,
} from '@onekeyhq/shared/src/routes';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import { Layout } from './utils/Layout';

import type { UseFormReturn } from 'react-hook-form';

const CustomFooter = ({
  index,
  form,
}: {
  index: number;
  form: UseFormReturn<any>;
}) => {
  const dialog = useDialogInstance();
  return (
    <XStack gap="$4" justifyContent="center">
      <Button
        onPress={() => {
          console.log(form?.getValues());
          void dialog.close();
        }}
      >
        Close
      </Button>
      <Button
        onPress={() => {
          Dialog.show({
            title: `#${index}`,
            // eslint-disable-next-line @typescript-eslint/no-use-before-define
            renderContent: <ContentA index={index} />,
            showFooter: false,
          });
        }}
      >
        New
      </Button>
    </XStack>
  );
};

function ContentA({ index }: { index: number }) {
  const form = useForm({});
  return (
    <Form form={form}>
      <Form.Field label="Password" name="password">
        <Input />
      </Form.Field>
      <CustomFooter form={form} index={index + 1} />
    </Form>
  );
}

function ScrollContent() {
  return (
    <ScrollView height={200}>
      <Stack height={150} bg="red" />
      <Stack height={150} bg="blue" />
      <Stack height={150} bg="black" />
    </ScrollView>
  );
}

const DialogNavigatorDemo = () => {
  const navigation = useAppNavigation<any>();
  return (
    <YStack gap="$3">
      <Button
        mt="$4"
        onPress={() => {
          Toast.error({
            title: 'Toaster is always on top 1',
            duration: 3000,
          });
          Dialog.show({
            title: 'Confirm whether the Dialog is always on top.',
            renderContent: <Input />,
            onConfirm: () => {},
          });
          setTimeout(() => {
            Toast.error({
              title: 'Toaster is always on top 2',
              duration: 3000,
            });
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            navigation.push(EGalleryRoutes.Components);
          }, 1500);
        }}
      >
        Test Visibility in Navigator(Stack)
      </Button>
      <Button
        mt="$4"
        onPress={() => {
          Toast.error({
            title: 'Toaster is always on top 1',
            duration: 3000,
          });
          Dialog.show({
            title: 'Confirm whether the Dialog is always on top.',
            renderContent: <Input />,
            onConfirm: () => {},
          });
          setTimeout(() => {
            Toast.error({
              title: 'Toaster is always on top 2',
              duration: 3000,
            });
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            navigation.pushModal(EModalRoutes.TestModal, {
              screen: ETestModalPages.TestSimpleModal,
            });
          }, 1500);
        }}
      >
        Test Visibility in Navigator(Modal)
      </Button>
    </YStack>
  );
};

function ContentFooter({
  onConfirm,
}: {
  onConfirm: (value: ICheckedState) => void;
}) {
  const [checkState, setCheckState] = useState(false as ICheckedState);
  const handleConfirm = useCallback(
    () =>
      new Promise<void>((resolve) => {
        setTimeout(() => {
          onConfirm(checkState);
          resolve();
        }, 1500);
      }),
    [checkState, onConfirm],
  );

  const handleCancel = useCallback(() => {
    console.log('cancel');
  }, []);
  return (
    <YStack>
      <Checkbox value={checkState} label="Read it" onChange={setCheckState} />
      <Dialog.Footer
        onConfirm={handleConfirm}
        onCancel={handleCancel}
        onConfirmText="Accept(wait 1.5s)"
        onCancelText="Noop"
      />
    </YStack>
  );
}

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
        title: 'Variants',
        element: (
          <YStack gap="$2">
            <Button
              onPress={async () => {
                let d = Dialog.show({
                  title: 'Lorem ipsum 1111',
                  icon: 'PlaceholderOutline',
                  description:
                    'Lorem ipsum dolor sit amet consectetur. Nisi in arcu ultrices neque vel nec.',
                  tone: 'default',
                });
                // not working
                await d.close();

                d = Dialog.show({
                  title: 'Lorem ipsum 2222',
                  icon: 'PlaceholderOutline',
                  description:
                    'Lorem ipsum dolor sit amet consectetur. Nisi in arcu ultrices neque vel nec.',
                  tone: 'default',
                });

                // working, should wait Dialog open animation done
                // await timerUtils.wait(350);
                // await d.close();
              }}
            >
              ShowAndCloseDialog1
            </Button>
            <Button
              onPress={async () => {
                let d = Dialog.show({
                  title: 'Lorem ipsum 1111',
                  icon: 'PlaceholderOutline',
                  description:
                    'Lorem ipsum dolor sit amet consectetur. Nisi in arcu ultrices neque vel nec.',
                  tone: 'default',
                });

                d = Dialog.show({
                  title: 'Lorem ipsum 2222',
                  icon: 'PlaceholderOutline',
                  description:
                    'Lorem ipsum dolor sit amet consectetur. Nisi in arcu ultrices neque vel nec.',
                  tone: 'default',
                });

                // working, should wait Dialog open animation done
                // await timerUtils.wait(350);
                // await d.close();
              }}
            >
              ShowAndCloseDialog2
            </Button>
            <Button
              onPress={() =>
                Dialog.show({
                  title: 'Lorem ipsum',
                  icon: 'PlaceholderOutline',
                  description:
                    'Lorem ipsum dolor sit amet consectetur. Nisi in arcu ultrices neque vel nec.',
                  tone: 'default',
                })
              }
            >
              tone Default
            </Button>
            <Button
              onPress={() =>
                Dialog.show({
                  title: 'Lorem ipsum',
                  icon: 'PlaceholderOutline',
                  description:
                    'Lorem ipsum dolor sit amet consectetur. Nisi in arcu ultrices neque vel nec.',
                  tone: 'destructive',
                })
              }
            >
              destructive
            </Button>
          </YStack>
        ),
      },
      {
        title: 'Hide Confirm Button',
        element: (
          <YStack>
            <Button
              onPress={() =>
                Dialog.cancel({
                  title: 'Lorem ipsum',
                  onCancelText: 'Bye',
                  description:
                    'Lorem ipsum dolor sit amet consectetur. Nisi in arcu ultrices neque vel nec.',
                })
              }
            >
              Hide Confirm Button
            </Button>
          </YStack>
        ),
      },
      {
        title: 'Hide dialog footer',
        element: (
          <YStack>
            <Button
              onPress={() =>
                Dialog.show({
                  title: 'Lorem ipsum',
                  showFooter: false,
                  description:
                    'Lorem ipsum dolor sit amet consectetur. Nisi in arcu ultrices neque vel nec.',
                })
              }
            >
              Hide dialog footer
            </Button>
          </YStack>
        ),
      },
      {
        title: 'Dialog.show & Dialog.confirm & Dialog.cancel',
        element: (
          <YStack gap="$4">
            <Button
              onPress={() =>
                Dialog.show({
                  title: 'show',
                  renderContent: <SizableText>Show</SizableText>,
                })
              }
            >
              Dialog.show
            </Button>
            <Button
              onPress={() =>
                Dialog.confirm({
                  title: 'confirm',
                  renderContent: <SizableText>wait 1500ms</SizableText>,
                  onConfirm: () =>
                    new Promise((resolve) => {
                      setTimeout(() => {
                        // do stuff
                        // close the dialog.
                        resolve();
                        // or keep the dialog here.
                        // reject();
                      }, 1500);
                    }),
                })
              }
            >
              Dialog.confirm
            </Button>
            <Button
              onPress={() =>
                Dialog.cancel({
                  title: 'confirm',
                  renderContent: <SizableText>cancel</SizableText>,
                })
              }
            >
              Dialog.cancel
            </Button>
          </YStack>
        ),
      },
      {
        title: 'Disabled Confirm Button',
        element: (
          <YStack gap="$4">
            <Button
              onPress={() =>
                Dialog.confirm({
                  title: 'show',
                  confirmButtonProps: { disabled: true },
                  renderContent: <SizableText>Show</SizableText>,
                })
              }
            >
              disabled Button
            </Button>
            <Button
              onPress={() =>
                Dialog.confirm({
                  title: 'Only `RESET` can be accept',
                  renderContent: (
                    <Dialog.Form
                      formProps={{
                        defaultValues: { text: 'hello' },
                      }}
                    >
                      <Dialog.FormField
                        name="text"
                        rules={{
                          required: {
                            value: true,
                            message: 'requied input text',
                          },
                        }}
                      >
                        <Input
                          autoFocus
                          flex={1}
                          placeholder="only numeric value"
                        />
                      </Dialog.FormField>
                    </Dialog.Form>
                  ),
                  confirmButtonProps: {
                    disabledOn: ({ getForm }) => {
                      const { getValues } = getForm() || {};
                      if (getValues) {
                        const { text } = getValues();
                        return text !== 'RESET';
                      }
                      return true;
                    },
                  },
                  onConfirm: () =>
                    new Promise((resolve) => {
                      setTimeout(() => {
                        // do stuff
                        // close the dialog.
                        resolve();
                        // or keep the dialog here.
                        // resolve(false);
                      }, 1500);
                    }),
                })
              }
            >
              disabled Button with Dialog Form
            </Button>

            <Button
              onPress={() =>
                Dialog.confirm({
                  title: 'Only `RESET` can be accept',
                  onConfirm: ({ getForm }) => {
                    const form = getForm();
                    if (form) {
                      console.log(form.getValues() as { text: string });
                    }
                  },
                  renderContent: (
                    <Dialog.Form
                      formProps={{
                        mode: 'onSubmit',
                        reValidateMode: 'onSubmit',
                        defaultValues: { text: '' },
                      }}
                    >
                      <Dialog.FormField
                        name="text"
                        rules={{
                          required: {
                            value: true,
                            message: 'requied input text',
                          },
                        }}
                      >
                        <Input
                          autoFocus
                          flex={1}
                          placeholder="only numeric value"
                        />
                      </Dialog.FormField>
                    </Dialog.Form>
                  ),
                })
              }
            >
              validate on Submit(not on blur)
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
                Dialog.show({
                  title: 'Lorem ipsum',
                  description:
                    'Lorem ipsum dolor sit amet consectetur. Nisi in arcu ultrices neque vel nec.',
                  onConfirm() {
                    return new Promise((resolve) => {
                      setTimeout(() => {
                        alert('loaded successful');
                        resolve();
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
                Dialog.show({
                  title: 'Lorem ipsum',
                  description:
                    'Lorem ipsum dolor sit amet consectetur. Nisi in arcu ultrices neque vel nec.',
                  onConfirm() {
                    return new Promise<void>((_, reject) => {
                      setTimeout(() => {
                        alert('loaded failed');
                        reject();
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
          <YStack gap="$4">
            <Button
              onPress={() =>
                Dialog.confirm({
                  title: 'Password',
                  description: 'input password',
                  renderContent: (
                    <Dialog.Form
                      formProps={{
                        defaultValues: { a: '1234567' },
                      }}
                    >
                      <Dialog.FormField
                        name="a"
                        rules={{
                          maxLength: { value: 6, message: 'maxLength is 6' },
                        }}
                      >
                        <Input
                          autoFocus
                          flex={1}
                          placeholder="only numeric value"
                        />
                      </Dialog.FormField>
                    </Dialog.Form>
                  ),
                  onConfirm: (dialogInstance) => {
                    alert(
                      JSON.stringify(dialogInstance.getForm()?.getValues()),
                    );
                  },
                })
              }
            >
              Open Dialog Form
            </Button>
            <Button
              onPress={() =>
                Dialog.confirm({
                  title: 'Password',
                  description: 'input password',
                  renderContent: (
                    <Dialog.Form
                      formProps={{
                        defaultValues: { a: '1234567' },
                      }}
                    >
                      <Dialog.FormField
                        name="a"
                        rules={{
                          maxLength: { value: 6, message: 'maxLength is 6' },
                        }}
                      >
                        <Select
                          title="Demo Title"
                          placeholder="select"
                          items={[
                            { label: 'Banana0', value: 'Banana' },
                            {
                              label: 'Apple1',
                              value: 'Apple',
                            },

                            {
                              label: 'Pear2',
                              value: 'Pear',
                            },

                            {
                              label: 'Blackberry3',
                              value: 'Blackberry',
                            },
                          ]}
                        />
                      </Dialog.FormField>
                    </Dialog.Form>
                  ),
                  onConfirm: (dialogInstance) => {
                    alert(
                      JSON.stringify(dialogInstance.getForm()?.getValues()),
                    );
                  },
                })
              }
            >
              Open Dialog Form with Select
            </Button>
          </YStack>
        ),
      },
      {
        title: 'Execute a function call once the dialog is closed',
        element: (
          <YStack gap="$4">
            <Button
              onPress={() =>
                Dialog.confirm({
                  title: 'call by Dismiss Function',
                  description: 'onClose',
                  onClose: () => {
                    alert('Execute it once the dialog is closed');
                  },
                })
              }
            >
              onClose Function
            </Button>
            <Button
              onPress={() => {
                const dialog = Dialog.show({
                  title: ' Dialog.close Promise',
                  description: ' Dialog.close Promise',
                  showFooter: false,
                  renderContent: (
                    <Button
                      onPress={async () => {
                        await dialog.close();
                        alert('Execute it once the dialog is closed');
                      }}
                    >
                      Close
                    </Button>
                  ),
                });
              }}
            >
              Dialog.close Promise
            </Button>
          </YStack>
        ),
      },
      {
        title: 'AutoFocus Input',
        element: (
          <YStack>
            <Button
              mt="$4"
              onPress={() =>
                Dialog.show({
                  title: 'Password',
                  description: 'input password',
                  renderContent: (
                    <Input
                      autoFocus
                      flex={1}
                      placeholder="only numeric value"
                    />
                  ),
                  onConfirm: () => {},
                })
              }
            >
              Open Dialog AutoFocus
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
                const dialog = Dialog.show({
                  title: '1500ms',
                  renderContent: (
                    <Input
                      autoFocus
                      flex={1}
                      placeholder="only numeric value"
                    />
                  ),
                  onConfirm: () => {},
                });
                setTimeout(() => {
                  void dialog.close();
                }, 1500);
              }}
            >
              Close Dialog!
            </Button>
            <Button
              mt="$4"
              onPress={() => {
                Dialog.show({
                  title: '#1',
                  renderContent: <ContentA index={1} />,
                  showFooter: false,
                });
              }}
            >
              Close Dialog by Hooks !
            </Button>
            <Button
              mt="$4"
              onPress={() => {
                Dialog.show({
                  title: 'the dialog cannot be closed by onConfirm Button',
                  onConfirm: () =>
                    new Promise((resolve, reject) => {
                      reject();
                    }),
                });
              }}
            >
              the dialog cannot be closed by onConfirm Button
            </Button>
            <Button
              mt="$4"
              onPress={() => {
                Dialog.show({
                  title: 'the dialog cannot be closed by onConfirm Button',
                  onConfirm: ({ close }) =>
                    new Promise((resolve) => {
                      setTimeout(async () => {
                        await close();
                        console.log('closed');
                      }, 100);
                      setTimeout(() => {
                        resolve();
                      }, 99_999_999);
                    }),
                });
              }}
            >
              close func
            </Button>
            <Button
              mt="$4"
              onPress={() => {
                Dialog.show({
                  title: 'preventClose',
                  onConfirm: ({ preventClose }) =>
                    new Promise((resolve) => {
                      setTimeout(async () => {
                        preventClose();
                        resolve();
                      }, 100);
                    }),
                });
              }}
            >
              preventClose func
            </Button>
          </YStack>
        ),
      },
      {
        title: 'Dialog Footer within renderContent',
        element: (
          <Button
            mt="$4"
            onPress={() => {
              Dialog.show({
                title: '#1',
                renderContent: (
                  <ContentFooter
                    onConfirm={(value) => {
                      console.log(value);
                    }}
                  />
                ),
              });
            }}
          >
            Dialog Footer within renderContent
          </Button>
        ),
      },
      {
        title: 'ScrollView Demo(not recommend, use Modal Page instead it))',
        element: (
          <YStack>
            <Button
              onPress={() => {
                Dialog.show({
                  title: '#ScrollContent',
                  dismissOnOverlayPress: false,
                  disableDrag: true,
                  renderContent: <ScrollContent />,
                });
              }}
            >
              Open ScrollContent
            </Button>
          </YStack>
        ),
      },
      {
        title: 'Test Visibility in Navigator',
        element: <DialogNavigatorDemo />,
      },
      {
        title: 'closeFlag',
        element: (
          <YStack>
            <Button
              onPress={() => {
                const dialog = Dialog.show({
                  title: 'show',
                  onConfirm: () => {},
                  onClose: (extra) => {
                    console.log('closeFlag:', extra);
                  },
                  renderContent: <SizableText>closeFlag</SizableText>,
                });
                setTimeout(() => {
                  void dialog.close({ flag: 'closeFlag' });
                }, 3000);
              }}
            >
              closeFlag
            </Button>
          </YStack>
        ),
      },
      {
        title: 'showExit',
        element: (
          <YStack>
            <Button
              onPress={() => {
                const Container = (
                  props: IDialogContainerProps,
                  ref: ForwardedRef<IDialogInstance>,
                ) => {
                  const [showExitButton, setIsShowExitButton] = useState(false);
                  useEffect(() => {
                    setTimeout(() => {
                      setIsShowExitButton(true);
                    }, 5000);
                  }, []);
                  return (
                    <DialogContainer
                      title="title"
                      ref={ref}
                      showExitButton={showExitButton}
                      renderContent={<SizableText>content</SizableText>}
                      onClose={async (data) => console.log(data)}
                    />
                  );
                };
                const ForwardedContainer = forwardRef(Container);
                Dialog.show({
                  dialogContainer: ({ ref }: { ref: any }) => (
                    <ForwardedContainer
                      ref={ref}
                      onClose={async (extra) => console.log(extra)}
                    />
                  ),
                });
              }}
            >
              showExitButton
            </Button>
          </YStack>
        ),
      },
      {
        title: 'Dialogs',
        element: (
          <YStack gap="$4">
            <Button
              onPress={() => {
                Dialog.show({
                  title: 'A',
                  description: 'AAAA',
                  renderContent: <Stack h={200} />,
                });
                setTimeout(() => {
                  Dialog.show({
                    title: 'B',
                    description: 'BBB',
                    sheetProps: {
                      zIndex: 1e5 + 2,
                    },
                  });
                }, 10);
              }}
            >
              Dialogs
            </Button>
            <Button
              onPress={() => {
                const SelectListItem = () => {
                  const [val, setVal] = useState('Apple');
                  return (
                    <Select
                      items={new Array(5).fill(undefined).map((_, index) => ({
                        label: String(index),
                        value: String(index),
                      }))}
                      value={val}
                      onChange={setVal}
                      title="Demo Title"
                      onOpenChange={console.log}
                    />
                  );
                };
                Dialog.show({
                  title: 'A',
                  description: 'AAAA',
                  renderContent: (
                    <Stack h={200}>
                      <SelectListItem />
                    </Stack>
                  ),
                });
              }}
            >
              Select In Dialog
            </Button>
          </YStack>
        ),
      },
      {
        title: 'open & close test',
        element: (
          <YStack gap="$4">
            <Button
              onPress={async () => {
                const d = Dialog.show({
                  title: 'Lorem ipsum',
                  icon: 'PlaceholderOutline',
                  description:
                    'Lorem ipsum dolor sit amet consectetur. Nisi in arcu ultrices neque vel nec.',
                  tone: 'default',
                });
                // working, should wait Dialog open animation done
                await timerUtils.wait(10);
                await d.close();
              }}
            >
              ShowAndClose
            </Button>
          </YStack>
        ),
      },
    ]}
  />
);

export default DialogGallery;
