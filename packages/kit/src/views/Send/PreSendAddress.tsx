import React from 'react';

import { RouteProp, useNavigation, useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import { Box, Form, Token, Typography, useForm } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useActiveWalletAccount } from '../../hooks/redux';
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
  useFormOnChangeDebounced<FormValues>({
    useFormReturn,
  });
  const { control, watch, trigger, getValues, formState } = useFormReturn;
  const navigation = useNavigation<NavigationProps>();
  const tokenInfo = useTokenInfo({
    networkId,
    tokenIdOnNetwork: transferInfo.token,
  });
  const watchedTo = watch('to');
  const submitDisabled =
    !watchedTo || !formState.isValid || !!Object.keys(formState.errors).length;

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
                label={intl.formatMessage({ id: 'content__to' })}
                labelAddon={platformEnv.isExtension ? [] : ['paste', 'scan']}
                onLabelAddonPress={() => trigger('to')} // call validation after paste
                control={control}
                name="to"
                formControlProps={{ width: 'full' }}
                rules={{
                  // required is NOT needed, as submit button should be disabled
                  // required: intl.formatMessage({ id: 'form__address_invalid' }),
                  validate: async (toAddress) => {
                    if (!toAddress) {
                      return undefined;
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
                    return true;
                  },
                }}
                defaultValue=""
              >
                <Form.Textarea
                  // TODO different max length in network
                  maxLength={80}
                  placeholder={intl.formatMessage({ id: 'form__address' })}
                  borderRadius="12px"
                  // numberOfLines={10}
                  h={{ base: 120, md: 120 }}
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
