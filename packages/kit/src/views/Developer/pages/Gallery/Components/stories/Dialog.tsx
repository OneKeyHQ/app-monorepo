import { useIsFocused, useNavigation } from '@react-navigation/core';

import {
  Button,
  Dialog,
  Form,
  Input,
  ScrollView,
  Stack,
  Text,
  Toast,
  XStack,
  YStack,
  useDialogInstance,
  useForm,
} from '@onekeyhq/components';
import type { IModalNavigationProp } from '@onekeyhq/components/src/layouts/Navigation';

import { EGalleryRoutes } from '../../../routes';

import { Layout } from './utils/Layout';

import type { UseFormReturn } from 'react-hook-form';

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
          dialog?.close();
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
                  renderContent: <Text>hide by Confirm button</Text>,
                  onConfirm: () =>
                    new Promise((resolve) => {
                      setTimeout(() => {
                        // do stuff
                        // close the dialog.
                        resolve(true);
                        // or keep the dialog here.
                        // resolve(false);
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
                      <Dialog.FormField name="text">
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
                        resolve(true);
                        // or keep the dialog here.
                        // resolve(false);
                      }, 1500);
                    }),
                })
              }
            >
              disabled Button with Dialog Confirm
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
                Dialog.show({
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
                  dialog.close();
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
          </YStack>
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
    ]}
  />
);

export default DialogGallery;
