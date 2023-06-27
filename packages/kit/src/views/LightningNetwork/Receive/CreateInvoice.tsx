import { useCallback, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Box,
  Form,
  Image,
  Modal,
  Text,
  useForm,
  useIsVerticalLayout,
} from '@onekeyhq/components';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useNavigation, useNetwork } from '../../../hooks';
import { ModalRoutes, RootRoutes } from '../../../routes/routesEnum';
import { ReceiveTokenModalRoutes } from '../../ReceiveToken/types';

import type { ModalScreenProps } from '../../../routes/types';
import type { ReceiveTokenRoutesParams } from '../../ReceiveToken/types';
import type { RouteProp } from '@react-navigation/core';

type NavigationProps = ModalScreenProps<ReceiveTokenRoutesParams>;
type RouteProps = RouteProp<
  ReceiveTokenRoutesParams,
  ReceiveTokenModalRoutes.CreateInvoice
>;

type FormValues = {
  amount: string;
  description: string;
};

const CreateInvoice = () => {
  const intl = useIntl();
  const isVerticalLayout = useIsVerticalLayout();
  const route = useRoute<RouteProps>();
  const navigation = useNavigation<NavigationProps['navigation']>();

  const { networkId, accountId } = route.params ?? {};
  const { network } = useNetwork({ networkId });
  const { control, handleSubmit } = useForm<FormValues>({
    mode: 'onChange',
  });
  const [validateMessage, setvalidateMessage] = useState({
    errorMessage: '',
  });

  const [isLoading, setIsLoading] = useState(false);

  const onSubmit = useCallback(
    async (values: FormValues) => {
      if (isLoading) return;
      if (!networkId || !accountId) return;
      setIsLoading(true);
      try {
        const invoice =
          await backgroundApiProxy.serviceLightningNetwork.createInvoice({
            networkId,
            accountId,
            amount: values.amount,
            description: values.description,
          });
        console.log('===> invoice: ', invoice);
        navigation.navigate(RootRoutes.Modal, {
          screen: ModalRoutes.Receive,
          params: {
            screen: ReceiveTokenModalRoutes.ReceiveInvoice,
            params: {
              networkId,
              accountId,
              paymentRequest: invoice.payment_request,
              paymentHash: invoice.payment_hash,
            },
          },
        });
      } catch (e: any) {
        console.error(e);
        const { key, info } = e;
        if (key) {
          setvalidateMessage({
            errorMessage: intl.formatMessage(
              {
                id: key,
              },
              info ?? {},
            ),
          });
          return false;
        }
        setvalidateMessage({
          errorMessage: intl.formatMessage({
            id: 'form__address_invalid',
          }),
        });
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, networkId, navigation, intl, accountId],
  );

  const doSubmit = handleSubmit(onSubmit);

  return (
    <Modal
      header={intl.formatMessage({ id: 'action__receive' })}
      headerDescription={
        <Box flexDirection="row" alignItems="center" mt={0.5}>
          <Image
            alt="logoURI"
            source={{ uri: network?.logoURI }}
            size={4}
            borderRadius="full"
            mr={2}
          />
          <Text textAlign="center" typography="Caption" color="text-subdued">
            {network?.name}
          </Text>
        </Box>
      }
      hideSecondaryAction
      primaryActionTranslationId="action__next"
      primaryActionProps={{
        isDisabled: isLoading,
        isLoading,
      }}
      onPrimaryActionPress={() => doSubmit()}
      height="auto"
      scrollViewProps={{
        contentContainerStyle: {
          flex: 1,
          paddingVertical: isVerticalLayout ? 16 : 24,
        },
        children: (
          <Form>
            <Form.Item
              label={intl.formatMessage({ id: 'content__amount' })}
              control={control}
              errorMessage={validateMessage.errorMessage}
              name="amount"
              formControlProps={{ width: 'full' }}
              rules={{
                required: {
                  value: true,
                  message: intl.formatMessage({
                    id: 'form__field_is_required',
                  }),
                },
                min: {
                  value: 0,
                  message: intl.formatMessage(
                    {
                      id: 'form__field_too_small',
                    },
                    {
                      0: 0,
                    },
                  ),
                },
                pattern: {
                  value: /^[0-9]*$/,
                  message: intl.formatMessage({
                    id: 'form__field_only_integer',
                  }),
                },
              }}
              defaultValue=""
            >
              <Form.Input
                type="number"
                size={isVerticalLayout ? 'xl' : 'default'}
              />
            </Form.Item>
            <Form.Item
              label={intl.formatMessage({ id: 'content__description' })}
              control={control}
              name="description"
              formControlProps={{ width: 'full' }}
              rules={{}}
              defaultValue=""
            >
              <Form.Textarea
                size={isVerticalLayout ? 'xl' : 'default'}
                totalLines={isVerticalLayout ? 3 : 5}
              />
            </Form.Item>
          </Form>
        ),
      }}
    />
  );
};

export default CreateInvoice;
