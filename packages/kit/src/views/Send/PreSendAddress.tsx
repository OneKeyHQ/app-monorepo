import React, { useCallback, useMemo, useState } from 'react';

import { RouteProp, useNavigation, useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import { Box, Form, Token, Typography, useForm } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { makeTimeoutPromise } from '@onekeyhq/kit/src/background/utils';
import AddressInput from '@onekeyhq/kit/src/components/AddressInput';
import NameServiceResolver, {
  useNameServiceStatus,
} from '@onekeyhq/kit/src/components/NameServiceResolver';
import { useActiveWalletAccount } from '@onekeyhq/kit/src/hooks';
import { useFormOnChangeDebounced } from '@onekeyhq/kit/src/hooks/useFormOnChangeDebounced';
import { useTokenInfo } from '@onekeyhq/kit/src/hooks/useTokenInfo';

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
  const transferInfo = useMemo(() => ({ ...route.params }), [route.params]);
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

  const {
    onChange: onNameServiceChange,
    disableSubmitBtn,
    address: resolvedAddress,
  } = useNameServiceStatus();

  const { control, getValues, formState, trigger, handleSubmit } =
    useFormReturn;
  const navigation = useNavigation<NavigationProps>();
  const tokenInfo = useTokenInfo({
    networkId,
    tokenIdOnNetwork: transferInfo.token,
  });
  const submitDisabled =
    isLoading ||
    !formValues?.to ||
    !isValid ||
    formState.isValidating ||
    disableSubmitBtn;

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

          return isContractAddress;
        },
        timeout: 600,
        timeoutResult: false,
      }),
    [networkId],
  );

  const syncStateAndReTriggerValidate = useCallback(
    (val) => {
      onNameServiceChange(val);
      trigger('to');
    },
    [trigger, onNameServiceChange],
  );

  const onSubmit = useCallback(
    (values: FormValues) => {
      const toVal = resolvedAddress || values.to;
      if (isLoading || !toVal) {
        return;
      }
      navigation.navigate(SendRoutes.PreSendAmount, {
        ...transferInfo,
        to: toVal,
      });
    },
    [resolvedAddress, isLoading, navigation, transferInfo],
  );
  const doSubmit = handleSubmit(onSubmit);

  return (
    <BaseSendModal
      height="auto"
      hideSecondaryAction
      header={intl.formatMessage({ id: 'modal__send_to' })}
      primaryActionTranslationId="action__next"
      primaryActionProps={{
        isDisabled: submitDisabled,
      }}
      onPrimaryActionPress={() => doSubmit()}
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
                helpText={(value) => (
                  <NameServiceResolver
                    name={value}
                    onChange={syncStateAndReTriggerValidate}
                    disableBTC={false}
                    networkId={networkId}
                  />
                )}
                rules={{
                  // required is NOT needed, as submit button should be disabled
                  // required: intl.formatMessage({ id: 'form__address_invalid' }),
                  validate: async (value: string) => {
                    const toAddress = resolvedAddress || value || '';
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
                      if (disableSubmitBtn) return;
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
