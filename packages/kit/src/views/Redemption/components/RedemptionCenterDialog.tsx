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
import { useOneKeyAuth } from '@onekeyhq/kit/src/components/OneKeyAuth/useOneKeyAuth';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { PrimeLoginDialogCancelError } from '@onekeyhq/shared/src/errors';
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

export function RedemptionCenterDialog({
  onClose,
  onSuccess,
}: IRedemptionCenterDialogProps) {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const { loginOneKeyId, isLoggedIn } = useOneKeyAuth();
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
        // TODO: Replace with actual API call to ServiceReferralCode
        // Example:
        // const result = await backgroundApiProxy.serviceReferralCode.redeemCode({ code });
        // if (!result.success) {
        //   form.setError('code', { message: result.error });
        //   preventClose?.();
        //   return;
        // }
        // const { upgradeInfo } = result;

        // TODO: Remove mock validation - simulate API delay
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // TODO: Remove mock validation logic when API is ready
        // Mock validation logic - for now, reject codes that don't start with "ONEKEY"
        if (!code.toUpperCase().startsWith('ONEKEY')) {
          defaultLogger.referral.redemption.redeemFailed(
            code,
            'Invalid code format',
          );
          form.setError('code', {
            message: intl.formatMessage({
              id: ETranslations.redemption_invalid_code_error,
            }),
          });
          preventClose?.();
          return;
        }

        defaultLogger.referral.redemption.redeemSuccess(code);

        onClose?.();

        // TODO: Replace mock upgrade info with actual API response
        // Success - show success dialog
        showRedemptionSuccessDialog({});

        onSuccess?.();
      } catch (error) {
        defaultLogger.referral.redemption.redeemError(
          code,
          error instanceof Error ? error.message : String(error),
        );
        form.setError('code', {
          message: intl.formatMessage({
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

      // Check login status, if not logged in, trigger login flow
      if (!isLoggedIn) {
        try {
          // Wait for login to complete, then continue with redeem
          await loginOneKeyId();
          // Login succeeded, continue with redeem
          await performRedeem(code, preventClose);
        } catch (error) {
          // User cancelled login, do nothing but keep dialog open
          if (error instanceof PrimeLoginDialogCancelError) {
            preventClose();
            return;
          }
          throw error;
        }
        return;
      }

      // Already logged in, proceed with redeem directly
      await performRedeem(code, preventClose);
    },
    [form, isLoggedIn, loginOneKeyId, performRedeem],
  );

  const isButtonDisabled = !codeValue?.trim() || isSubmitting;

  return (
    <YStack mx="$-5">
      {/* History button - absolute positioned at top left */}
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

      {/* Content */}
      <YStack px="$5" py="$5" alignItems="center">
        {/* Icon */}
        <Stack bg="$bgStrong" borderRadius="$full" p="$3" mb="$5">
          <Icon name="TicketOutline" size="$10" color="$icon" />
        </Stack>

        {/* Title and Description */}
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

        {/* Form */}
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

      {/* Footer with Redeem Button */}
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
  const { onSuccess, ...restProps } = props;

  const dialog = Dialog.show({
    showFooter: false,
    renderContent: (
      <RedemptionCenterDialog
        {...restProps}
        onSuccess={onSuccess}
        onClose={async () => {
          await dialog.close();
        }}
      />
    ),
  });
  return dialog;
}
