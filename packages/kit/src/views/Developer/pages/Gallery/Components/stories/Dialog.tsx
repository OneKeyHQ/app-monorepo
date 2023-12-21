import { useCallback, useState } from 'react';

import { useIsFocused, useNavigation } from '@react-navigation/core';
import { StyleSheet } from 'react-native';

import type { IButtonProps, ICheckedState } from '@onekeyhq/components';
import {
  Alert,
  Button,
  Checkbox,
  Dialog,
  Form,
  IconButton,
  Input,
  LottieView,
  ScrollView,
  SizableText,
  Stack,
  Text,
  Toast,
  XStack,
  YStack,
  useDialogInstance,
  useForm,
  useMedia,
} from '@onekeyhq/components';
import type { IModalNavigationProp } from '@onekeyhq/components/src/layouts/Navigation';

import { EGalleryRoutes } from '../../../routes';

import { Layout } from './utils/Layout';

import type { UseFormReturn } from 'react-hook-form';

function CreateHiddenWalletDemo() {
  const form = useForm();
  const media = useMedia();

  return (
    <Button
      onPress={() => {
        const dialog = Dialog.show({
          title: 'Enter Passphrase',
          showFooter: false,
          renderContent: (
            <Stack>
              <Stack pb="$5">
                <Alert
                  title="Protect Your Passphrase: Irrecoverable if Lost."
                  type="warning"
                />
              </Stack>
              <Form form={form}>
                <Form.Field name="passphrase" label="Passphrase">
                  <Input
                    placeholder="Enter passphrase"
                    {...(media.md && {
                      size: 'large',
                    })}
                  />
                </Form.Field>
                <Form.Field name="confirmPassphrase" label="Confirm Passphrase">
                  <Input
                    placeholder="Re-enter your passphrase"
                    {...(media.md && {
                      size: 'large',
                    })}
                  />
                </Form.Field>
              </Form>
              {/* TODO: add loading state while waiting for result */}
              <Button
                mt="$5"
                $md={
                  {
                    size: 'large',
                  } as IButtonProps
                }
                variant="primary"
                onPress={async () => {
                  await dialog.close();
                  Dialog.show({
                    icon: 'CheckboxSolid',
                    title: 'Keep Your Wallet Accessible?',
                    description:
                      'Save this wallet to your device to maintain access after the app is closed. Unsaved wallets will be removed automatically.',
                    onConfirm: () => console.log('confirmed'),
                    onConfirmText: 'Save Wallet',
                    confirmButtonProps: {
                      variant: 'secondary',
                    },
                    onCancel: () => console.log('canceled'),
                    onCancelText: "Don't Save",
                  });
                }}
              >
                Confirm
              </Button>
              <Button
                m="$0"
                mt="$2"
                $md={
                  {
                    size: 'large',
                  } as IButtonProps
                }
                variant="tertiary"
              >
                Enter on Device
              </Button>
            </Stack>
          ),
        });
      }}
    >
      Enter Passphrase
    </Button>
  );
}

const CustomFooter = ({
  index,
  form,
}: {
  index: number;
  form: UseFormReturn<any>;
}) => {
  // test Navigation Container hooks
  const isFocused = useIsFocused();
  console.log('isFocused', isFocused);
  const dialog = useDialogInstance();
  return (
    <XStack space="$4" justifyContent="center">
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
  const navigation = useNavigation<
    IModalNavigationProp<{
      [EGalleryRoutes.Components]: undefined;
    }>
  >();
  return (
    <YStack>
      <Button
        mt="$4"
        onPress={() => {
          Dialog.show({
            title: 'Confirm whether the Dialog is always on top.',
            renderContent: <Input />,
            onConfirm: () => {},
          });
          setTimeout(() => {
            Toast.error({
              title: 'Toaster is always on top',
              duration: 3,
            });
            navigation.push(EGalleryRoutes.Components);
          }, 1500);
        }}
      >
        Test Visibility in Navigator
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
          <YStack space="$2">
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
                Dialog.show({
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
                  onConfirmText: 'OK',
                  onCancelText: 'Bye',
                  showFooter: false,
                  description:
                    'Lorem ipsum dolor sit amet consectetur. Nisi in arcu ultrices neque vel nec.',
                  onConfirm() {
                    alert('confirmed');
                  },
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
          <YStack space="$4">
            <Button
              onPress={() =>
                Dialog.show({
                  title: 'show',
                  renderContent: <Text>Show</Text>,
                })
              }
            >
              Dialog.show
            </Button>
            <Button
              onPress={() =>
                Dialog.confirm({
                  title: 'confirm',
                  renderContent: <Text>wait 1500ms</Text>,
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
                  renderContent: <Text>cancel</Text>,
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
          <YStack space="$4">
            <Button
              onPress={() =>
                Dialog.confirm({
                  title: 'show',
                  confirmButtonProps: { disabled: true },
                  renderContent: <Text>Show</Text>,
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
          <YStack>
            <Button
              mt="$4"
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
          </YStack>
        ),
      },
      {
        title: 'Execute a function call once the dialog is closed',
        element: (
          <YStack space="$4">
            <Button
              onPress={() =>
                Dialog.confirm({
                  title: 'call by Dismiss Function',
                  description: 'onDismiss',
                  onDismiss: () => {
                    alert('Execute it once the dialog is closed');
                  },
                })
              }
            >
              onDismiss Function
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
                      }, 99999999);
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
        title: 'ScrollView Demo(not recommand, use Modal Page instead it))',
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
        title: 'Interactive with hardware wallet',
        element: (
          <Stack space="$4">
            <Button
              onPress={() => {
                Dialog.show({
                  disableDrag: true,
                  dismissOnOverlayPress: false,
                  showFooter: false,
                  floatingPanelProps: {
                    mt: '$5',
                    mb: 'auto',
                  },
                  renderContent: (
                    <XStack alignItems="center" mb="$-2.5" mt="$2.5" ml="$-2.5">
                      <Stack
                        w="$16"
                        h="$16"
                        bg="$bgStrong"
                        borderRadius="$2"
                        style={{ borderCurve: 'continuous' }}
                        justifyContent="center"
                        alignItems="center"
                      >
                        <LottieView
                          width={64}
                          height={64}
                          source={require('../../../../../../../assets/animations/confirm-on-classic.json')}
                        />
                      </Stack>
                      <SizableText
                        size="$bodyLgMedium"
                        textAlign="center"
                        pl="$4"
                      >
                        Confirm on Device
                      </SizableText>
                    </XStack>
                  ),
                });
              }}
            >
              Confirm On Device
            </Button>
            <Button
              onPress={() =>
                Dialog.show({
                  title: 'Enter PIN',
                  showFooter: false,
                  renderContent: (
                    <Stack>
                      <Stack
                        borderWidth={StyleSheet.hairlineWidth}
                        borderColor="$borderSubdued"
                        borderRadius="$2"
                        overflow="hidden"
                        style={{
                          borderCurve: 'continuous',
                        }}
                      >
                        <XStack
                          h="$12"
                          alignItems="center"
                          px="$3"
                          borderBottomWidth={StyleSheet.hairlineWidth}
                          borderColor="$borderSubdued"
                          bg="$bgSubdued"
                        >
                          <SizableText
                            pl="$6"
                            textAlign="center"
                            flex={1}
                            size="$heading4xl"
                          >
                            ••••••
                          </SizableText>
                          <IconButton
                            variant="tertiary"
                            icon="XBackspaceOutline"
                          />
                        </XStack>
                        <XStack flexWrap="wrap">
                          {Array.from({ length: 9 }).map((_, index) => (
                            <Stack
                              key={index}
                              flexBasis="33.3333%"
                              h="$14"
                              borderRightWidth={StyleSheet.hairlineWidth}
                              borderBottomWidth={StyleSheet.hairlineWidth}
                              borderColor="$borderSubdued"
                              justifyContent="center"
                              alignItems="center"
                              {...((index === 2 ||
                                index === 5 ||
                                index === 8) && {
                                borderRightWidth: 0,
                              })}
                              {...((index === 6 ||
                                index === 7 ||
                                index === 8) && { borderBottomWidth: 0 })}
                              hoverStyle={{
                                bg: '$bgHover',
                              }}
                              pressStyle={{
                                bg: '$bgActive',
                              }}
                              focusable
                              focusStyle={{
                                outlineColor: '$focusRing',
                                outlineOffset: -2,
                                outlineWidth: 2,
                                outlineStyle: 'solid',
                              }}
                            >
                              <Stack
                                w="$2.5"
                                h="$2.5"
                                borderRadius="$full"
                                bg="$text"
                              />
                            </Stack>
                          ))}
                        </XStack>
                      </Stack>
                      {/* TODO: add loading state while waiting for result */}
                      <Button
                        mt="$5"
                        $md={
                          {
                            size: 'large',
                          } as IButtonProps
                        }
                        variant="primary"
                        onPress={() =>
                          Toast.error({
                            title: 'Wrong PIN',
                          })
                        }
                      >
                        Confirm
                      </Button>
                      <Button
                        m="$0"
                        mt="$2"
                        $md={
                          {
                            size: 'large',
                          } as IButtonProps
                        }
                        variant="tertiary"
                      >
                        Enter on Device
                      </Button>
                    </Stack>
                  ),
                })
              }
            >
              Enter PIN
            </Button>
            <Button
              onPress={() => {
                Dialog.show({
                  title: 'Enter PIN on Device',
                  renderContent: (
                    <Stack borderRadius="$3" bg="$bgSubdued">
                      <LottieView
                        source={require('../../../../../../../assets/animations/enter-pin-on-classic.json')}
                      />
                    </Stack>
                  ),
                  showFooter: false,
                });
              }}
            >
              Enter PIN on Device
            </Button>
            <CreateHiddenWalletDemo />
            <Button
              onPress={() => {
                Dialog.show({
                  title: 'Enter Passphrase on Device',
                  renderContent: (
                    <Stack borderRadius="$3" bg="$bgSubdued">
                      <LottieView
                        source={require('../../../../../../../assets/animations/enter-passphrase-on-classic.json')}
                      />
                    </Stack>
                  ),
                  showFooter: false,
                });
              }}
            >
              Enter Passphrase on Device
            </Button>
            <Button
              onPress={() => {
                Dialog.show({
                  title: 'Confirm Passphrase',
                  showFooter: false,
                  renderContent: (
                    <Stack>
                      {/* TODO: switch size to large when media.md */}
                      <Input placeholder="Enter your passphrase" />
                      {/* TODO: add loading state while waiting for result */}
                      <Button
                        mt="$5"
                        $md={
                          {
                            size: 'large',
                          } as IButtonProps
                        }
                        variant="primary"
                      >
                        Confirm
                      </Button>
                      <Button
                        m="$0"
                        mt="$2"
                        $md={
                          {
                            size: 'large',
                          } as IButtonProps
                        }
                        variant="tertiary"
                      >
                        Enter on Device
                      </Button>
                    </Stack>
                  ),
                });
              }}
            >
              Confirm Passphrase
            </Button>
          </Stack>
        ),
      },
    ]}
  />
);

export default DialogGallery;
