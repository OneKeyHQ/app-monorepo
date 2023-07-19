import type { FC } from 'react';
import { useCallback, useRef, useState } from 'react';

import { useNavigation, useRoute } from '@react-navigation/native';
import { useIntl } from 'react-intl';
import uuidLib from 'react-native-uuid';

import { Box, Form, Modal, useForm } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { InscribeModalRoutesParams } from '@onekeyhq/kit/src/routes/Root/Modal/Inscribe';
import type { ModalScreenProps } from '@onekeyhq/kit/src/routes/types';

import AddressInput from '../../../components/AddressInput';
import { useActiveSideAccount } from '../../../hooks';
import { InscribeModalRoutes } from '../../../routes/routesEnum';
import HeaderDescription from '../Components/HeaderDescription';
import Steps from '../Components/Steps';
import { OrderButton } from '../OrderList';

import type { RouteProp } from '@react-navigation/core';

type NavigationProps = ModalScreenProps<InscribeModalRoutesParams>;

type RouteProps = RouteProp<
  InscribeModalRoutesParams,
  InscribeModalRoutes.ReceiveAddress
>;

export type FormValues = {
  address: string;
};
const ReceiveAddress: FC = () => {
  const intl = useIntl();
  const route = useRoute<RouteProps>();
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const navigation = useNavigation<NavigationProps['navigation']>();

  const { serviceInscribe } = backgroundApiProxy;
  const { networkId, accountId, contents, size, file } = route?.params || {};
  const { account, network } = useActiveSideAccount({ accountId, networkId });

  const addressFilter = useCallback(
    async (address: string) => {
      try {
        return await serviceInscribe.checkValidTaprootAddress({
          address,
          networkId,
          accountId,
        });
      } catch (error) {
        return Promise.resolve(false);
      }
    },
    [accountId, networkId, serviceInscribe],
  );
  const {
    control,
    watch,
    formState: { isValid },
  } = useForm<FormValues>({
    defaultValues: { address: account?.address },
    mode: 'onChange',
  });
  const [validateMessage, setvalidateMessage] = useState({
    warningMessage: '',
    successMessage: '',
    errorMessage: '',
  });
  const address = watch('address');

  const validateHandle = useCallback(
    (value: string) => {
      if (timer.current) {
        clearTimeout(timer.current);
      }
      timer.current = setTimeout(async () => {
        try {
          setvalidateMessage({
            warningMessage: '',
            errorMessage: '',
            successMessage: '',
          });
          const isTaprootAddress =
            await serviceInscribe.checkValidTaprootAddress({
              address: value,
              networkId,
              accountId,
            });
          if (isTaprootAddress) {
            setvalidateMessage({
              warningMessage: '',
              errorMessage: '',
              successMessage: intl.formatMessage({
                id: 'form__enter_recipient_address_valid',
              }),
            });
          } else {
            setvalidateMessage({
              warningMessage: '',
              errorMessage: intl.formatMessage({
                id: 'msg__invalid_address_ordinal_can_only_be_sent_to_taproot_address',
              }),
              successMessage: '',
            });
          }
          return isTaprootAddress;
        } catch (error) {
          setvalidateMessage({
            warningMessage: '',
            errorMessage: intl.formatMessage({
              id: 'msg__invalid_address_ordinal_can_only_be_sent_to_taproot_address',
            }),
            successMessage: '',
          });
          return false;
        }
      }, 100);
    },
    [accountId, intl, networkId, serviceInscribe],
  );

  const submitDisabled =
    address.length === 0 || !isValid || validateMessage.errorMessage.length > 0;
  return (
    <Modal
      header={intl.formatMessage({ id: 'title__inscribe' })}
      headerDescription={<HeaderDescription network={network} />}
      rightContent={<OrderButton />}
      height="640px"
      primaryActionTranslationId="action__next"
      hideSecondaryAction
      staticChildrenProps={{
        flex: 1,
        padding: '16px',
      }}
      primaryActionProps={{
        onPress: () => {
          navigation.navigate(InscribeModalRoutes.CreateOrder, {
            file,
            networkId,
            accountId,
            receiveAddress: address,
            contents,
            size,
            orderId: uuidLib.v4() as string,
          });
        },
        isDisabled: submitDisabled,
        // isLoading: isLoadingAssets,
      }}
    >
      <Box w="full" h="full">
        <Form>
          <Steps numberOfSteps={3} currentStep={2} />
          <Form.Item
            control={control}
            name="address"
            label={intl.formatMessage({
              id: 'form__address_to_receive_inscription',
            })}
            warningMessage={validateMessage.warningMessage}
            successMessage={validateMessage.successMessage}
            errorMessage={validateMessage.errorMessage}
            rules={{
              required: {
                value: true,
                message: intl.formatMessage({
                  id: 'form__field_is_required',
                }),
              },
              // @ts-expect-error
              validate: validateHandle,
            }}
          >
            <AddressInput
              maxLength={103}
              networkId={networkId}
              placeholder={intl.formatMessage({
                id: 'form__address',
              })}
              description={intl.formatMessage({
                id: 'content__enter_the_taproot_address_to_receive_ordinal_inscriptions',
              })}
              h={{ base: 120, md: 120 }}
              plugins={['contact', 'paste', 'scan']}
              addressFilter={addressFilter}
            />
          </Form.Item>
        </Form>
      </Box>
    </Modal>
  );
};

export default ReceiveAddress;
