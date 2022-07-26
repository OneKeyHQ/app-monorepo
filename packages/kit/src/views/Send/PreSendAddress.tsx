import React, { useCallback, useState } from 'react';

import { RouteProp, useNavigation, useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import { Box, Form, Token, Typography, useForm } from '@onekeyhq/components';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { makeTimeoutPromise } from '../../background/utils';
import AddressInput from '../../components/AddressInput';
import { useActiveWalletAccount } from '../../hooks';
import { useFormOnChangeDebounced } from '../../hooks/useFormOnChangeDebounced';
import { useTokenInfo } from '../../hooks/useTokenInfo';

import { BaseSendModal } from './components/BaseSendModal';
import { SendRoutes, SendRoutesParams } from './types';

import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type NavigationProps = NativeStackNavigationProp<
  SendRoutesParams,
  SendRoutes.PreSendAddress
>;
type RouteProps = RouteProp<SendRoutesParams, SendRoutes.PreSendAddress>;

type FormValues = {
  to: string;
};

function PreSendAddress() {
  const intl = useIntl();
  const route = useRoute<RouteProps>();
  const transferInfo = { ...route.params };
  const { networkId } = useActiveWalletAccount();
  const useFormReturn = useForm<FormValues>({
    mode: 'onBlur',
    reValidateMode: 'onBlur',
    defaultValues: {
      to: transferInfo.to || '',
    },
  });
  const { isLoading, formValues, isValid } =
    useFormOnChangeDebounced<FormValues>({
      useFormReturn,
    });
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { control, watch, trigger, getValues, formState } = useFormReturn;
  const navigation = useNavigation<NavigationProps>();
  const tokenInfo = useTokenInfo({
    networkId,
    tokenIdOnNetwork: transferInfo.token,
  });
  const submitDisabled =
    isLoading || !formValues?.to || !isValid || formState.isValidating;

  const [warningMessage, setWarningMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const isContractAddressCheck = useCallback(
    (address: string) =>
      makeTimeoutPromise({
        asyncFunc: async () => {
          const isContractAddress =
            await backgroundApiProxy.validator.isContractAddress(
              networkId,
              address,
            );
          // await delay(10000);
          return isContractAddress;
        },
        timeout: 600,
        timeoutResult: false,
      }),
    [networkId],
  );

  return (
    <BaseSendModal
      height="auto"
      hideSecondaryAction
      header={intl.formatMessage({ id: 'modal__send_to' })}
      primaryActionTranslationId="action__next"
      primaryActionProps={{
        isDisabled: submitDisabled,
      }}
      onPrimaryActionPress={() => {
        navigation.navigate(SendRoutes.PreSendAmount, {
          ...transferInfo,
          to: getValues('to'),
        });
      }}
      scrollViewProps={{
        children: (
          <Box>
            <Form>
              <Box flexDirection="row" alignItems="center">
                <Token size={8} src={tokenInfo?.logoURI} />
                <Typography.Body1Strong ml={3}>
                  {tokenInfo?.symbol}
                </Typography.Body1Strong>
              </Box>
              <Form.Item
                control={control}
                warningMessage={warningMessage}
                successMessage={successMessage}
                name="to"
                formControlProps={{ width: 'full' }}
                rules={{
                  // required is NOT needed, as submit button should be disabled
                  // required: intl.formatMessage({ id: 'form__address_invalid' }),
                  validate: async () => {
                    const toAddress = formValues?.to || '';
                    setSuccessMessage('');
                    setWarningMessage('');
                    if (!toAddress) {
                      return undefined;
                      // return intl.formatMessage({
                      //   id: 'form__address_invalid',
                      // });
                    }
                    try {
                      await backgroundApiProxy.validator.validateAddress(
                        networkId,
                        toAddress,
                      );
                    } catch (error0) {
                      return intl.formatMessage({
                        id: 'form__address_invalid',
                      });
                    }
                    const isContractAddress = await isContractAddressCheck(
                      toAddress,
                    );
                    if (isContractAddress) {
                      setWarningMessage(
                        intl.formatMessage({
                          id: 'msg__the_recipient_address_is_a_contract_address',
                        }),
                      );
                      setSuccessMessage('');
                    } else {
                      setWarningMessage('');
                      setSuccessMessage(
                        intl.formatMessage({
                          id: 'form__enter_recipient_address_valid',
                        }),
                      );
                    }
                    return true;
                  },
                }}
                defaultValue=""
              >
                <AddressInput
                  // TODO different max length in network
                  maxLength={80}
                  networkId={networkId}
                  placeholder={intl.formatMessage({ id: 'form__address' })}
                  // numberOfLines={10}
                  h={{ base: 120, md: 120 }}
                  plugins={['contact', 'paste', 'scan']}
                />
              </Form.Item>
            </Form>
          </Box>
        ),
      }}
    />
  );
}

export { PreSendAddress };
