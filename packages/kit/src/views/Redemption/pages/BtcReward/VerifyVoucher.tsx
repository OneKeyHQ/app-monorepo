import { useCallback, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Form,
  Icon,
  Input,
  Page,
  SizableText,
  XStack,
  YStack,
  useForm,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EModalReferFriendsRoutes } from '@onekeyhq/shared/src/routes';
import type { IBtcRewardCodeInfoParam } from '@onekeyhq/shared/src/routes';

import type { RouteProp } from '@react-navigation/core';

type IRouteParams = RouteProp<
  {
    BtcRewardVerifyVoucher: {
      codeInfo: IBtcRewardCodeInfoParam;
    };
  },
  'BtcRewardVerifyVoucher'
>;

interface IFormValues {
  voucherCode: string;
}

const EXAMPLE_VOUCHER = '#1001';

function VerifyVoucherPage() {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const route = useRoute<IRouteParams>();
  const { codeInfo } = route.params;

  const [isVerifying, setIsVerifying] = useState(false);

  const form = useForm<IFormValues>({
    defaultValues: { voucherCode: '' },
    mode: 'onChange',
  });

  const voucherCodeValue = form.watch('voucherCode');

  const handleVerify = useCallback(async () => {
    const voucherCode = form.getValues('voucherCode').trim();
    if (!voucherCode) return;

    setIsVerifying(true);
    form.clearErrors('voucherCode');

    try {
      const result =
        await backgroundApiProxy.serviceReferralCode.btcRewardVerifyVoucher({
          codeId: codeInfo.codeId,
          voucherCode,
        });
      if (!result.success) {
        form.setError('voucherCode', { message: result.error.message });
        return;
      }

      navigation.push(EModalReferFriendsRoutes.BtcRewardSelectAddress, {
        codeInfo,
        voucherCode,
        displayTitle: result.data.displayTitle,
        quotaRemaining: result.data.quotaRemaining,
      });
    } catch {
      form.setError('voucherCode', {
        message: intl.formatMessage({
          id: ETranslations.redemption_btc_confirm_error_desc,
        }),
      });
    } finally {
      setIsVerifying(false);
    }
  }, [form, navigation, codeInfo, intl]);

  return (
    <Page scrollEnabled>
      <Page.Header
        title={intl.formatMessage({
          id: ETranslations.redemption_btc_verify_order_title,
        })}
      />
      <Page.Body px="$5" py="$4">
        <YStack gap="$4">
          <SizableText size="$bodyMd" color="$textSubdued">
            {intl.formatMessage({
              id: ETranslations.redemption_btc_verify_order_description,
            })}
          </SizableText>

          <Form form={form}>
            <Form.Field
              name="voucherCode"
              label={intl.formatMessage({
                id: ETranslations.redemption_btc_verify_order_input_label,
              })}
            >
              <Input
                size="large"
                placeholder={intl.formatMessage(
                  {
                    id: ETranslations.redemption_btc_verify_order_input_placeholder,
                  },
                  { example: EXAMPLE_VOUCHER },
                )}
                autoCorrect={false}
              />
            </Form.Field>
          </Form>

          <XStack bg="$bgSubdued" borderRadius="$3" p="$3" gap="$2">
            <Icon name="QuestionmarkOutline" size="$5" color="$iconSubdued" />
            <YStack flex={1} gap="$1">
              <SizableText size="$bodyMdMedium">
                {intl.formatMessage({
                  id: ETranslations.redemption_btc_verify_order_hint_title,
                })}
              </SizableText>
              <SizableText size="$bodyMd" color="$textSubdued">
                {`• ${intl.formatMessage({
                  id: ETranslations.redemption_btc_verify_order_hint_shopify,
                })}`}
              </SizableText>
              <SizableText size="$bodyMd" color="$textSubdued">
                {`• ${intl.formatMessage({
                  id: ETranslations.redemption_btc_verify_order_hint_offline,
                })}`}
              </SizableText>
            </YStack>
          </XStack>
        </YStack>
      </Page.Body>

      <Page.Footer
        onConfirm={handleVerify}
        onConfirmText={intl.formatMessage({
          id: ETranslations.redemption_btc_verify_order_submit,
        })}
        confirmButtonProps={{
          disabled: !voucherCodeValue?.trim() || isVerifying,
          loading: isVerifying,
        }}
      />
    </Page>
  );
}

export default VerifyVoucherPage;
