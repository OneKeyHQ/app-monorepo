import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { CommonActions } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Alert,
  Form,
  Input,
  Page,
  SizableText,
  Toast,
  YStack,
  useForm,
  useFormWatch,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { IAddressInputValue } from '@onekeyhq/kit/src/components/AddressInput';
import {
  AddressInput,
  createValidateAddressRule,
} from '@onekeyhq/kit/src/components/AddressInput';
import { AddressInputContext } from '@onekeyhq/kit/src/components/AddressInput/AddressInputContext';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { RedemptionTestIDs } from '@onekeyhq/kit/src/views/Redemption/testIDs';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EBtcRewardErrorCode } from '@onekeyhq/shared/src/referralCode/type';
import { EModalReferFriendsRoutes } from '@onekeyhq/shared/src/routes';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

interface IRecoverFormValues {
  sourceRef: string;
  redeemCode: string;
  baseAddress: IAddressInputValue;
}

const baseNetworkId = getNetworkIdsMap().base;

const ADDRESS_INPUT_CONTEXT_VALUE = {
  name: 'baseAddress',
  networkId: baseNetworkId,
};

function BtcRewardRecoverPage() {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const isSubmittingRef = useRef(false);
  const recoverNotFoundMessage = intl.formatMessage({
    id: ETranslations.redemption_btc_recover_not_found_description,
  });
  const recoverGenericErrorMessage = intl.formatMessage({
    id: ETranslations.redemption_btc_confirm_error_desc,
  });

  const form = useForm<IRecoverFormValues>({
    defaultValues: {
      sourceRef: '',
      redeemCode: '',
      baseAddress: { raw: '', resolved: undefined },
    },
    mode: 'onChange',
    reValidateMode: 'onBlur',
  });
  const { control } = form;
  const { errors } = form.formState;
  const sourceRefValue = form.watch('sourceRef');
  const redeemCodeValue = form.watch('redeemCode');
  const baseAddressValue = useFormWatch({ control, name: 'baseAddress' });

  useEffect(() => {
    setSubmitError(null);
  }, [baseAddressValue.raw, redeemCodeValue, sourceRefValue]);

  const canSubmit = useMemo(() => {
    if (isSubmitting || Object.values(errors).length) return false;
    return (
      !!sourceRefValue?.trim() &&
      !!redeemCodeValue?.trim() &&
      !baseAddressValue.pending &&
      !!baseAddressValue.resolved
    );
  }, [
    baseAddressValue.pending,
    baseAddressValue.resolved,
    errors,
    isSubmitting,
    redeemCodeValue,
    sourceRefValue,
  ]);

  const handleSubmit = useCallback(async () => {
    if (isSubmittingRef.current || !canSubmit) {
      return;
    }

    const values = form.getValues();
    const baseAddress = values.baseAddress.resolved;
    if (!baseAddress) {
      return;
    }

    isSubmittingRef.current = true;
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const [result] = await Promise.all([
        backgroundApiProxy.serviceReferralCode.btcRewardRecoverRecord({
          code: values.redeemCode.trim(),
          voucherCode: values.sourceRef.trim(),
          walletAddress: baseAddress,
        }),
        timerUtils.wait(500),
      ]);

      if (!result.success) {
        setSubmitError(
          result.error.code === EBtcRewardErrorCode.RecoverNotFound
            ? recoverNotFoundMessage
            : result.error.message,
        );
        return;
      }

      Toast.success({
        title: intl.formatMessage({
          id: ETranslations.redemption_btc_recover_success_toast,
        }),
      });
      navigation.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: EModalReferFriendsRoutes.RedemptionHistory }],
        }),
      );
    } catch {
      setSubmitError(recoverGenericErrorMessage);
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  }, [
    canSubmit,
    form,
    intl,
    navigation,
    recoverGenericErrorMessage,
    recoverNotFoundMessage,
  ]);

  return (
    <Page scrollEnabled>
      <Page.Header
        title={intl.formatMessage({
          id: ETranslations.redemption_btc_recover_title,
        })}
      />
      <Page.Body px="$5" py="$4">
        <YStack gap="$4">
          <SizableText size="$bodyMd" color="$textSubdued">
            {intl.formatMessage({
              id: ETranslations.redemption_btc_recover_description,
            })}
          </SizableText>

          <Form form={form}>
            <YStack gap="$4">
              <Form.Field
                name="redeemCode"
                label={intl.formatMessage({
                  id: ETranslations.redemption_btc_label_code,
                })}
                rules={{
                  required: intl.formatMessage({
                    id: ETranslations.redemption_btc_recover_code_required_message,
                  }),
                }}
              >
                <Input
                  testID={RedemptionTestIDs.btcRewardRecoverCodeInput}
                  size="large"
                  placeholder={intl.formatMessage({
                    id: ETranslations.redemption_btc_recover_code_placeholder,
                  })}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </Form.Field>

              <Form.Field
                name="sourceRef"
                label={intl.formatMessage({
                  id: ETranslations.redemption_btc_verify_order_input_label,
                })}
                rules={{
                  required: intl.formatMessage({
                    id: ETranslations.redemption_btc_recover_order_required_message,
                  }),
                }}
              >
                <Input
                  testID={RedemptionTestIDs.btcRewardRecoverSourceInput}
                  size="large"
                  placeholder={intl.formatMessage(
                    {
                      id: ETranslations.redemption_btc_verify_order_input_placeholder,
                    },
                    { example: '#1001' },
                  )}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </Form.Field>

              <AddressInputContext.Provider value={ADDRESS_INPUT_CONTEXT_VALUE}>
                <Form.Field
                  name="baseAddress"
                  label={intl.formatMessage({
                    id: ETranslations.redemption_btc_recover_original_address_label,
                  })}
                  rules={{
                    validate: createValidateAddressRule({
                      defaultErrorMessage: intl.formatMessage({
                        id: ETranslations.form_address_error_invalid,
                      }),
                    }),
                  }}
                >
                  <AddressInput
                    networkId={baseNetworkId}
                    placeholder={intl.formatMessage({
                      id: ETranslations.redemption_btc_recover_address_placeholder,
                    })}
                  />
                </Form.Field>
              </AddressInputContext.Provider>
            </YStack>
          </Form>

          {submitError ? (
            <Alert
              type="critical"
              title={intl.formatMessage({
                id: ETranslations.redemption_btc_recover_failed_title,
              })}
              description={submitError}
            />
          ) : null}
        </YStack>
      </Page.Body>
      <Page.Footer
        onConfirm={handleSubmit}
        onConfirmText={intl.formatMessage({
          id: ETranslations.redemption_btc_recover_submit,
        })}
        confirmButtonProps={{
          disabled: !canSubmit,
          loading: isSubmitting,
        }}
      />
    </Page>
  );
}

export default BtcRewardRecoverPage;
