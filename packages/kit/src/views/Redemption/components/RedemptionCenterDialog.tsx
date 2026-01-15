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
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import {
  EModalReferFriendsRoutes,
  EModalRoutes,
} from '@onekeyhq/shared/src/routes';

import { showRedemptionSuccessDialog } from './RedemptionSuccessDialog';

interface IRedemptionFormValues {
  code: string;
}

export interface IRedemptionCenterDialogProps {
  onClose?: () => void;
  onSuccess?: () => void;
}

function RedemptionCenterDialogContent({
  onClose,
  onSuccess,
}: IRedemptionCenterDialogProps) {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<IRedemptionFormValues>({
    defaultValues: {
      code: '',
    },
    mode: 'onChange',
  });

  const codeValue = form.watch('code');

  const handleHistoryPress = useCallback(() => {
    onClose?.();
    navigation.pushModal(EModalRoutes.ReferFriendsModal, {
      screen: EModalReferFriendsRoutes.RedemptionHistory,
    });
  }, [navigation, onClose]);

  const performRedeem = useCallback(
    async (code: string, preventClose?: () => void) => {
      defaultLogger.referral.redemption.startRedeem(code);

      setIsSubmitting(true);
      form.clearErrors('code');

      try {
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

        onClose?.();
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
        defaultLogger.referral.redemption.redeemError(code, errorMessage);
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
    [form, intl, onClose, onSuccess],
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
  const { onSuccess } = props;

  const dialog = Dialog.show({
    showFooter: false,
    renderContent: (
      <RedemptionCenterDialogContent
        onSuccess={onSuccess}
        onClose={async () => {
          await dialog.close();
        }}
      />
    ),
  });
  return dialog;
}
