import React, { FC, useEffect, useMemo, useState } from 'react';

import { RouteProp, useRoute } from '@react-navigation/core';
import { useNavigation } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import {
  Box,
  Button,
  Center,
  Form,
  Icon,
  Image,
  KeyboardDismissView,
  Modal,
  Pressable,
  ZStack,
  useForm,
} from '@onekeyhq/components';
import { Wallet } from '@onekeyhq/engine/src/types/wallet';
import { useAppDispatch } from '@onekeyhq/kit/src/hooks/redux';
import {
  ManagerWalletModalRoutes,
  ManagerWalletRoutesParams,
} from '@onekeyhq/kit/src/routes/Modal/ManagerWallet';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useToast } from '../../../hooks/useToast';
import { updateWallet } from '../../../store/reducers/wallet';

type FieldValues = { name: string };

type RouteProps = RouteProp<
  ManagerWalletRoutesParams,
  ManagerWalletModalRoutes.ManagerWalletModifyNameModal
>;

const ModifyWalletNameViewModal: FC = () => {
  const intl = useIntl();
  const toast = useToast();
  const dispatch = useAppDispatch();
  const navigation = useNavigation();
  const { engine } = backgroundApiProxy;

  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [wallet, setWallet] = useState<Wallet>();
  const [isLoading, setIsLoading] = React.useState(false);

  const { walletId } = useRoute<RouteProps>().params;

  useEffect(() => {
    engine.getWallets().then(($wallets) => {
      setWallets($wallets);
      setWallet($wallets.find((w) => w.id === walletId));
    });
  }, [engine, walletId]);

  const { control, handleSubmit, setError } = useForm<FieldValues>({
    defaultValues: { name: '' },
  });
  const onSubmit = handleSubmit(async (values: FieldValues) => {
    setIsLoading(true);
    // 判断名字重复
    const existsName = wallets.find((w) => w.name === values.name);
    if (existsName) {
      setError('name', {
        message: intl.formatMessage({
          id: 'form__account_name_invalid_exists',
        }),
      });
      setIsLoading(false);
      return;
    }
    const changedWallet = await engine.setWalletName(walletId, values.name);
    if (changedWallet) {
      dispatch(updateWallet(changedWallet));
      toast.info(intl.formatMessage({ id: 'msg__change_saved' }));
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
            toast.info(intl.formatMessage({ id: 'msg__coming_soon' }));
          }}
        >
          <ZStack width="68px" height="68px">
            <Box
              width="full"
              height="full"
              justifyContent="center"
              alignItems="center"
            >
              <Image
                src="https://i.pinimg.com/236x/4e/80/3b/4e803ba3e1dc26104ad9917f301a04c6.jpg"
                width="56px"
                height="56px"
              />
            </Box>
            <Box
              width="full"
              height="full"
              justifyContent="flex-end"
              alignItems="flex-end"
            >
              <Box
                size={6}
                borderRadius="full"
                bg="surface-neutral-default"
                justifyContent="center"
                alignItems="center"
              >
                <Icon name="PencilSolid" size={16} />
              </Box>
            </Box>
          </ZStack>
        </Pressable>
      </Center>
    ),
    [intl, toast],
  );

  return (
    <Modal
      header={intl.formatMessage({ id: 'modal__edit_wallet' })}
      footer={null}
    >
      <KeyboardDismissView px={{ base: 4, md: 0 }}>
        {ImageView}
        <Form mt="3">
          <Form.Item
            name="name"
            defaultValue=""
            control={control}
            rules={{
              required: intl.formatMessage({ id: 'form__field_is_required' }),
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
            <Form.Input placeholder={wallet?.name ?? ''} />
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
