import { useCallback, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';
import { YStack } from 'tamagui';

import type { IPageNavigationProp } from '@onekeyhq/components';
import { Form, Page, useForm } from '@onekeyhq/components';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import { AddressInput } from '../../../../components/AddressInput';
import useAppNavigation from '../../../../hooks/useAppNavigation';
import { useFormOnChangeDebounced } from '../../../../hooks/useFormOnChangeDebounced';
import { usePromiseResult } from '../../../../hooks/usePromiseResult';
import { EModalRoutes } from '../../../../routes/Modal/type';
import { SendAssets } from '../../components/SendAssets';
import { EModalSendRoutes } from '../../router';

import type { IModalSendParamList } from '../../router';
import type { ISendAddressFormValues } from '../../types';
import type { RouteProp } from '@react-navigation/core';

function SendAddressInputContainer() {
  const intl = useIntl();
  const [isValidatingAddress, setIsValidatingAddress] = useState(false);

  const navigation =
    useAppNavigation<IPageNavigationProp<IModalSendParamList>>();

  const route =
    useRoute<
      RouteProp<IModalSendParamList, EModalSendRoutes.SendAddressInput>
    >();

  const { networkId, accountId, transfersInfo } = route.params;
  const transferInfo = transfersInfo[0];

  const useFormReturn = useForm<ISendAddressFormValues>({
    mode: 'onBlur',
    reValidateMode: 'onBlur',
    defaultValues: {
      to: transfersInfo[0].to || '',
    },
  });

  const assets = usePromiseResult(async () => {
    const r = await backgroundApiProxy.serviceToken.fetchTokenDetail({
      networkId,
      accountAddress: transferInfo.from,
      address: transferInfo.token,
      isNative: !transferInfo.token,
    });
    return [r.info];
  }, [networkId, transferInfo.from, transferInfo.token]);

  const { formState, handleSubmit } = useFormReturn;

  const resolvedAddress = '';

  const { isLoading, formValues, isValid } =
    useFormOnChangeDebounced<ISendAddressFormValues>({
      useFormReturn,
    });

  const handleConfirm = useCallback(
    (values: ISendAddressFormValues) => {
      const toValue = values.to || resolvedAddress;

      if (!toValue) return;

      const updatedTransfersInfo = transfersInfo.map((t) => ({
        ...t,
        to: toValue,
      }));
      navigation.pushModal(EModalRoutes.SendModal, {
        screen: EModalSendRoutes.SendAmountInput,
        params: {
          networkId,
          accountId,
          transfersInfo: updatedTransfersInfo,
        },
      });
    },
    [accountId, navigation, networkId, transfersInfo],
  );

  const submitDisabled =
    isLoading ||
    !formValues?.to ||
    !isValid ||
    formState.isValidating ||
    isValidatingAddress;

  const doSubmit = handleSubmit(handleConfirm);

  const handleValidateAddress = useCallback(
    async (value: string) => {
      const toAddress = resolvedAddress || value || '';

      if (!toAddress) {
        return undefined;
      }

      try {
        setIsValidatingAddress(true);
        const validation =
          await backgroundApiProxy.serviceValidator.validateAddress({
            networkId,
            address: toAddress,
          });
        if (!validation.isValid) throw new Error('form__address_invalid');
      } catch (error: any) {
        console.error('SendAddress handleValidateAddress ERROR: ', error);
        setIsValidatingAddress(false);
        const { key, info } = error;
        if (key) {
          return intl.formatMessage(
            {
              id: key,
            },
            info ?? {},
          );
        }
        return intl.formatMessage({
          id: 'form__address_invalid',
        });
      }

      setIsValidatingAddress(false);
      return true;
    },
    [intl, networkId],
  );

  return (
    <Page>
      <Page.Header title={intl.formatMessage({ id: 'modal__send_to' })} />
      <Page.Body px="$4">
        <YStack>
          <Form form={useFormReturn}>
            {assets.result && <SendAssets assets={assets.result} />}
            <Form.Field
              name="to"
              rules={{
                validate: handleValidateAddress,
              }}
              defaultValue=""
            >
              <AddressInput networkId={networkId} />
            </Form.Field>
          </Form>
        </YStack>
      </Page.Body>
      <Page.Footer
        onCancel={() => navigation.popStack()}
        onConfirm={() => doSubmit()}
        confirmButtonProps={{ disabled: submitDisabled }}
        onConfirmText={intl.formatMessage({ id: 'action__next' })}
      />
    </Page>
  );
}

export { SendAddressInputContainer };
