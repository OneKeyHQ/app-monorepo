import { useCallback, useState } from 'react';

import { useIntl } from 'react-intl';

import type { IDialogInstance } from '@onekeyhq/components';
import {
  Button,
  Dialog,
  Form,
  Icon,
  Input,
  SizableText,
  Stack,
  YStack,
  useForm,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useOneKeyAuth } from '@onekeyhq/kit/src/components/OneKeyAuth/useOneKeyAuth';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { PrimeLoginDialogCancelError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type { IRedemptionCenterSource } from '@onekeyhq/shared/src/logger/scopes/referral/scenes/redemption';
import { EBtcRewardErrorCode } from '@onekeyhq/shared/src/referralCode/type';
import {
  EModalReferFriendsRoutes,
  EModalRoutes,
} from '@onekeyhq/shared/src/routes';

import { RedemptionTestIDs } from '../testIDs';

import { showRedemptionSuccessDialog } from './RedemptionSuccessDialog';

interface IRedemptionFormValues {
  code: string;
}

export interface IRedemptionCenterDialogProps {
  initialCode?: string;
  source?: IRedemptionCenterSource;
  onClose?: () => Promise<void> | void;
  onSuccess?: () => void;
}

function RedemptionCenterDialogContent({
  initialCode,
  source = 'unknown',
  onClose,
  onSuccess,
}: IRedemptionCenterDialogProps) {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const { isLoggedIn, loginOneKeyId } = useOneKeyAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<IRedemptionFormValues>({
    defaultValues: {
      code: initialCode?.trim() ?? '',
    },
    mode: 'onChange',
  });

  const codeValue = form.watch('code');
  const hasInitialCode = Boolean(initialCode?.trim());

  const handleHistoryPress = useCallback(async () => {
    await onClose?.();
    navigation.pushModal(EModalRoutes.ReferFriendsModal, {
      screen: EModalReferFriendsRoutes.RedemptionHistory,
    });
  }, [navigation, onClose]);

  const performRedeem = useCallback(
    async (code: string, preventClose?: () => void) => {
      setIsSubmitting(true);
      form.clearErrors('code');
      let isLegacyFallback = false;
      let hasLoggedBtcVerifyResult = false;

      try {
        // Server has no unified endpoint, so dispatch between the two
        // redemption modes (BTC reward vs legacy rebate level upgrade) by
        // trying btc-reward first and falling back to redeemCode only when
        // the server confirms the code is unknown to BTC (CodeNotFound).
        const btcResult =
          await backgroundApiProxy.serviceReferralCode.btcRewardVerifyCode({
            code,
          });

        if (btcResult.success) {
          defaultLogger.referral.redemption.btcRewardCodeVerifyResult({
            result: 'success',
            source,
            hasInitialCode,
          });
          hasLoggedBtcVerifyResult = true;

          // verify-code only validates the code; the actual redemption is the
          // commit at the end of the BTC reward flow. Log success there.
          await onClose?.();
          navigation.pushModal(EModalRoutes.ReferFriendsModal, {
            screen: EModalReferFriendsRoutes.BtcRewardVerifyVoucher,
            params: {
              codeInfo: {
                codeId: btcResult.data.codeId,
                batchName: btcResult.data.batchName,
                rewardUsd: btcResult.data.rewardUsd,
              },
            },
          });
          return;
        }

        // Only the server-confirmed "this code is not in the BTC system"
        // signal (CodeNotFound, 100_304) triggers the legacy fallback.
        // InvalidCode (100_300) means the code IS a BTC code but is bad
        // (format/expired/used) — surface that directly instead of
        // routing the user through a misleading OneKey ID login. Transport
        // / envelope failures normalize to Unknown and also stay on the
        // BTC path so a real BTC code during a BTC outage is not sent
        // down the legacy channel.
        if (btcResult.error.code !== EBtcRewardErrorCode.CodeNotFound) {
          defaultLogger.referral.redemption.btcRewardCodeVerifyResult({
            result: 'failed',
            source,
            hasInitialCode,
            errorCode: btcResult.error.code,
          });
          hasLoggedBtcVerifyResult = true;

          const message =
            btcResult.error.code === EBtcRewardErrorCode.Unknown
              ? intl.formatMessage({
                  id: ETranslations.redemption_btc_confirm_error_desc,
                })
              : btcResult.error.message;
          form.setError('code', { message });
          preventClose?.();
          return;
        }

        defaultLogger.referral.redemption.btcRewardCodeVerifyResult({
          result: 'not_found',
          source,
          hasInitialCode,
          errorCode: btcResult.error.code,
        });
        hasLoggedBtcVerifyResult = true;
        isLegacyFallback = true;

        // legacy redeemCode requires OneKey ID auth; prompt login before the
        // fallback so logged-out users can still redeem a legacy rebate code
        // (the redemption center entry no longer gates on login).
        if (!isLoggedIn) {
          try {
            await loginOneKeyId();
          } catch (loginError) {
            if (loginError instanceof PrimeLoginDialogCancelError) {
              preventClose?.();
              return;
            }
            throw loginError;
          }
        }

        defaultLogger.referral.redemption.startRedeem(code);

        const result = await backgroundApiProxy.serviceReferralCode.redeemCode({
          code,
        });

        if (!result.success) {
          defaultLogger.referral.redemption.redeemFailed(
            code,
            result.error?.message ?? 'Redemption failed',
          );
          form.setError('code', {
            message:
              result.error?.message ??
              intl.formatMessage({
                id: ETranslations.redemption_invalid_code_error,
              }),
          });
          preventClose?.();
          return;
        }

        defaultLogger.referral.redemption.redeemSuccess(code);

        await onClose?.();
        showRedemptionSuccessDialog({
          upgradeInfo: result.upgradeInfo,
        });

        onSuccess?.();
      } catch (error) {
        const axiosError = error as {
          response?: { data?: { message?: string } };
        };
        const errorMessage =
          axiosError?.response?.data?.message ??
          (error instanceof Error ? error.message : String(error));
        if (isLegacyFallback) {
          defaultLogger.referral.redemption.redeemError(code, errorMessage);
        } else if (!hasLoggedBtcVerifyResult) {
          defaultLogger.referral.redemption.btcRewardCodeVerifyResult({
            result: 'failed',
            source,
            hasInitialCode,
            errorCode: EBtcRewardErrorCode.Unknown,
          });
        }
        form.setError('code', {
          message:
            errorMessage ??
            intl.formatMessage({
              id: ETranslations.redemption_invalid_code_error,
            }),
        });
        preventClose?.();
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      form,
      hasInitialCode,
      intl,
      isLoggedIn,
      loginOneKeyId,
      navigation,
      onClose,
      onSuccess,
      source,
    ],
  );

  const handleRedeem = useCallback(
    async ({
      preventClose,
    }: IDialogInstance & { preventClose: () => void }) => {
      const code = form.getValues('code').trim();
      if (!code) {
        preventClose();
        return;
      }

      await performRedeem(code, preventClose);
    },
    [form, performRedeem],
  );

  const isButtonDisabled = !codeValue?.trim() || isSubmitting;

  return (
    <YStack mx="$-5">
      <Button
        testID={RedemptionTestIDs.historyBtn}
        variant="tertiary"
        size="medium"
        onPress={handleHistoryPress}
        position="absolute"
        top="$-5"
        left="$5"
        zIndex={1}
      >
        {intl.formatMessage({
          id: ETranslations.redemption_history_title,
        })}
      </Button>

      <YStack px="$5" py="$5" alignItems="center">
        <Stack bg="$bgStrong" borderRadius="$full" p="$3" mb="$5">
          <Icon name="TicketOutline" size="$10" color="$icon" />
        </Stack>

        <SizableText size="$headingXl" textAlign="center" mb="$1">
          {intl.formatMessage({
            id: ETranslations.redemption_center_title,
          })}
        </SizableText>
        <SizableText
          size="$bodyLg"
          color="$textSubdued"
          textAlign="center"
          mb="$5"
        >
          {intl.formatMessage({
            id: ETranslations.redemption_center_description,
          })}
        </SizableText>

        <YStack width="100%">
          <Form form={form}>
            <Form.Field name="code">
              <Input
                testID={RedemptionTestIDs.codeInput}
                size="large"
                placeholder={intl.formatMessage({
                  id: ETranslations.redemption_enter_code_placeholder,
                })}
                autoCapitalize="characters"
                autoCorrect={false}
              />
            </Form.Field>
          </Form>
        </YStack>
      </YStack>

      <Dialog.Footer
        showCancelButton={false}
        onConfirm={handleRedeem}
        onConfirmText={intl.formatMessage({
          id: ETranslations.redemption_redeem_button,
        })}
        confirmButtonProps={{
          disabled: isButtonDisabled,
          loading: isSubmitting,
        }}
      />
    </YStack>
  );
}

export function showRedemptionCenterDialog(
  props: Omit<IRedemptionCenterDialogProps, 'onClose'> = {},
): IDialogInstance {
  const { initialCode, onSuccess, source = 'unknown' } = props;
  defaultLogger.referral.redemption.redemptionCenterOpen({
    source,
    hasInitialCode: Boolean(initialCode?.trim()),
  });

  const dialog = Dialog.show({
    showFooter: false,
    renderContent: (
      <RedemptionCenterDialogContent
        initialCode={initialCode}
        source={source}
        onSuccess={onSuccess}
        onClose={async () => {
          await dialog.close();
        }}
      />
    ),
  });
  return dialog;
}
