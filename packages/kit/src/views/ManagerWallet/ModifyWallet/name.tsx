import type { FC } from 'react';
import { useMemo, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import { useNavigation } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import {
  Box,
  Button,
  Center,
  Form,
  Icon,
  KeyboardDismissView,
  Modal,
  Pressable,
  ToastManager,
  ZStack,
  useForm,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import WalletAvatar from '@onekeyhq/kit/src/components/WalletSelector/WalletAvatar';
import { useRuntime } from '@onekeyhq/kit/src/hooks/redux';
import type { ManagerWalletRoutesParams } from '@onekeyhq/kit/src/routes/Root/Modal/ManagerWallet';
import {
  ManagerWalletModalRoutes,
  ModalRoutes,
  RootRoutes,
} from '@onekeyhq/kit/src/routes/routesEnum';
import { setRefreshTS } from '@onekeyhq/kit/src/store/reducers/settings';
import type { Avatar } from '@onekeyhq/shared/src/utils/emojiUtils';
import { defaultAvatar } from '@onekeyhq/shared/src/utils/emojiUtils';

import type { RouteProp } from '@react-navigation/core';

type FieldValues = { name: string };

type RouteProps = RouteProp<
  ManagerWalletRoutesParams,
  ManagerWalletModalRoutes.ManagerWalletModifyNameModal
>;

const ModifyWalletNameViewModal: FC = () => {
  const intl = useIntl();

  const navigation = useNavigation();
  const { walletId } = useRoute<RouteProps>().params;
  const { engine, dispatch, serviceCloudBackup, serviceAccount } =
    backgroundApiProxy;
  const { wallets } = useRuntime();
  const wallet = wallets.find((w) => w.id === walletId) ?? null;
  const [isLoading, setIsLoading] = useState(false);
  const [editAvatar, updateAvatar] = useState<Avatar>(
    wallet?.avatar ?? defaultAvatar,
  );
  const { control, handleSubmit, setError } = useForm<FieldValues>({
    defaultValues: { name: '' },
  });
  const onSubmit = handleSubmit(async (values: FieldValues) => {
    setIsLoading(true);
    const editName = values.name === '' ? wallet?.name : values.name;
    // 判断名字重复
    const existsName = wallets.find(
      (w) => w.name === editName && w.name !== wallet?.name,
    );
    if (existsName) {
      setError('name', {
        message: intl.formatMessage({
          id: 'form__account_name_invalid_exists',
        }),
      });
      setIsLoading(false);
      return;
    }
    const changedWallet = await engine.setWalletNameAndAvatar(walletId, {
      name: editName,
      avatar: editAvatar,
    });
    if (changedWallet) {
      serviceCloudBackup.requestBackup();
      // dispatch(updateWallet(changedWallet)); // won't update wallets order
      await serviceAccount.initWallets();
      setTimeout(() => dispatch(setRefreshTS()));
      ToastManager.show({
        title: intl.formatMessage({ id: 'msg__change_saved' }),
      });
      navigation.getParent()?.goBack();
    } else {
      setError('name', {
        message: intl.formatMessage({ id: 'msg__unknown_error' }),
      });
    }
    setIsLoading(false);
  });

  const ImageView = useMemo(
    () => (
      <Center>
        <Pressable
          onPress={() => {
            navigation.navigate(RootRoutes.Modal, {
              screen: ModalRoutes.ManagerWallet,
              params: {
                screen: ManagerWalletModalRoutes.ManagerWalletModifyEmojiModal,
                params: {
                  avatar: editAvatar,
                  onDone: (avatar) => {
                    updateAvatar(() => avatar);
                  },
                },
              },
            });
          }}
        >
          {({ isHovered }) => (
            <ZStack width="56px" height="56px">
              <Box
                width="full"
                height="full"
                justifyContent="center"
                alignItems="center"
              >
                <WalletAvatar avatar={editAvatar} walletImage="hd" size="xl" />
              </Box>
              <Box
                size={6}
                justifyContent="center"
                alignItems="center"
                borderWidth={2}
                bg={isHovered ? 'surface-hovered' : 'surface-neutral-default'}
                borderColor="surface-subdued"
                borderRadius="full"
                right="-12px"
                bottom="-12px"
              >
                <Icon name="PencilMini" size={16} />
              </Box>
            </ZStack>
          )}
        </Pressable>
      </Center>
    ),
    [editAvatar, navigation],
  );

  return (
    <Modal
      header={intl.formatMessage({ id: 'modal__edit_wallet' })}
      footer={null}
    >
      <KeyboardDismissView px={{ base: 4, md: 0 }}>
        {ImageView}
        <Form mt="6">
          <Form.Item
            name="name"
            defaultValue=""
            control={control}
            rules={{
              maxLength: {
                value: 24,
                message: intl.formatMessage(
                  {
                    id: 'form__account_name_invalid_characters_limit',
                  },
                  { 0: '24' },
                ),
              },
            }}
          >
            <Form.Input size="xl" autoFocus placeholder={wallet?.name ?? ''} />
          </Form.Item>
          <Button
            type="primary"
            size="xl"
            isLoading={isLoading}
            onPress={onSubmit}
          >
            {intl.formatMessage({
              id: 'action__done',
            })}
          </Button>
        </Form>
      </KeyboardDismissView>
    </Modal>
  );
};

export default ModifyWalletNameViewModal;
