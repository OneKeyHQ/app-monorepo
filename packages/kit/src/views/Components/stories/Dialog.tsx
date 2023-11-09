import { useState } from 'react';

import { useNavigation } from '@react-navigation/core';

import {
  Button,
  Dialog,
  Form,
  Input,
  Toast,
  XStack,
  YStack,
  useDialogInstance,
  useForm,
} from '@onekeyhq/components';
import type { IDialogProps } from '@onekeyhq/components/src/Dialog/type';
import type { IModalNavigationProp } from '@onekeyhq/components/src/Navigation';

import { EGalleryRoutes } from '../../../routes/Root/Tab/Developer/Gallery/routes';

import { Layout } from './utils/Layout';

import type { UseFormReturn } from 'react-hook-form';

const VariantsDemo = ({ tone }: IDialogProps) => {
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

const CustomFooter = ({
  index,
  form,
}: {
  index: number;
  form: UseFormReturn<any>;
}) => {
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
          Dialog.confirm({
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
          Dialog.confirm({
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
          <XStack space="$4">
            <VariantsDemo />
            <VariantsDemo tone="destructive" />
          </XStack>
        ),
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
        title: 'Dialog & AutoFocus Input',
        element: (
          <YStack>
            <Button
              mt="$4"
              onPress={() =>
                Dialog.confirm({
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
                Dialog.confirm({
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
        title: 'Test Visibility in Navigator',
        element: <DialogNavigatorDemo />,
      },
    ]}
  />
);

export default DialogGallery;
