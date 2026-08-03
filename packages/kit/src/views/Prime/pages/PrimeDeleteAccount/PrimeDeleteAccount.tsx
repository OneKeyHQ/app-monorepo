import { useCallback, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Alert,
  Checkbox,
  Dialog,
  Illustration,
  Page,
  SizableText,
  Stack,
  Toast,
  YStack,
} from '@onekeyhq/components';
import { Markdown } from '@onekeyhq/components/src/content/Markdown';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useOneKeyAuth } from '@onekeyhq/kit/src/components/OneKeyAuth/useOneKeyAuth';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { EPrimeEmailOTPScene } from '@onekeyhq/shared/src/consts/primeConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { EReasonForNeedPassword } from '@onekeyhq/shared/types/setting';

export default function PrimeDeleteAccount() {
  const { user, sendEmailOTP } = useOneKeyAuth();
  const navigation = useAppNavigation();
  const intl = useIntl();

  const { result: _canDeleteAccount } = usePromiseResult(
    async () => {
      // Check if user has active subscription or other restrictions
      const isLoggedIn = await backgroundApiProxy.servicePrime.isLoggedIn();
      if (!isLoggedIn) {
        return { canDelete: false, reason: 'No access token' };
      }

      // Check if user has active Prime subscription
      if (user?.primeSubscription?.isActive) {
        return {
          canDelete: false,
          reason: intl.formatMessage({
            id: ETranslations.Limit_expire_day,
          }),
        };
      }

      return { canDelete: true, reason: null };
    },
    [user, intl],
    {
      watchLoading: true,
    },
  );

  const handleDeleteAccount = useCallback(async () => {
    const isPasswordSet =
      await backgroundApiProxy.servicePassword.checkPasswordSet();
    //   passcode verify if passcode is set
    if (isPasswordSet) {
      await backgroundApiProxy.servicePassword.promptPasswordVerify({
        reason: EReasonForNeedPassword.Security,
      });
    }
    await sendEmailOTP({
      scene: EPrimeEmailOTPScene.DeleteOneKeyId,
      onConfirm: async ({ code, uuid }) => {
        const deleteResult =
          await backgroundApiProxy.serviceIdentityExit.deleteOneKeyIdAccount({
            uuid,
            emailOTP: code,
          });

        if (
          deleteResult.serverOutcome === 'unknown' &&
          deleteResult.localStateCleared
        ) {
          defaultLogger.prime.subscription.onekeyIdLogout({
            reason: 'PrimeDeleteAccount: server outcome unknown',
          });
          defaultLogger.prime.subscription.onekeyIdAtomNotLoggedIn({
            reason: 'PrimeDeleteAccount: server outcome unknown',
          });
          navigation.popStack();
          Dialog.show({
            dismissOnOverlayPress: false,
            disableDrag: true,
            icon: 'ErrorOutline',
            tone: 'warning',
            // TODO: i18n
            title: 'Account deletion could not be confirmed',
            // TODO: i18n
            description:
              "You have been signed out on this device, but we couldn't confirm that your account was deleted on the server. Sign in again later to check the account.",
            showCancelButton: false,
            // TODO: i18n
            onConfirmText: 'Done',
          });
          return;
        }

        if (!deleteResult?.ok) {
          Toast.error({
            title: intl.formatMessage({
              id: ETranslations.global_failed,
            }),
          });
          return;
        }

        defaultLogger.prime.subscription.onekeyIdLogout({
          reason: 'PrimeDeleteAccount: handleDeleteAccount',
        });
        defaultLogger.prime.subscription.onekeyIdAtomNotLoggedIn({
          reason: 'PrimeDeleteAccount',
        });
        navigation.popStack();
        Dialog.show({
          dismissOnOverlayPress: false,
          disableDrag: true,
          icon: 'CheckRadioSolid',
          tone: 'success',
          title: intl.formatMessage({
            id: ETranslations.id_onekey_id_deleted_title,
          }),
          description: intl.formatMessage({
            id: ETranslations.id_onekey_id_deleted_desc,
          }),
          showCancelButton: false,
          onConfirmText: intl.formatMessage({
            id: ETranslations.global_done,
          }),
          onConfirm: async () => {
            console.log('onConfirm');
          },
        });
      },
    });

    // try {
    //   const token = await getAccessToken();
    //   if (!token) {
    //     Toast.error({
    //       title: intl.formatMessage({
    //         id: ETranslations.prime_onekeyid_log_out,
    //       }),
    //     });
    //     return;
    //   }

    //   // Show final confirmation dialog
    //   Dialog.show({
    //     icon: 'ErrorOutline',
    //     tone: 'destructive',
    //     title: intl.formatMessage({
    //       id: ETranslations.prime_onekeyid_log_out,
    //     }),
    //     description: intl.formatMessage({
    //       id: ETranslations.prime_onekeyid_log_out_description,
    //     }),
    //     onConfirmText: intl.formatMessage({
    //       id: ETranslations.id_delete_onekey_id,
    //     }),
    //     onConfirm: async () => {
    //       try {
    //         // Call the delete account API
    //         await backgroundApiProxy.servicePrime.apiDeletePrimeAccount({
    //           accessToken: token,
    //         });

    //         // Logout after successful deletion
    //         await logout();

    //         Toast.success({
    //           title: intl.formatMessage({
    //             id: ETranslations.prime_onekeyid_log_out,
    //           }),
    //         });

    //         // Navigate back to login or dashboard
    //         navigation.popStack();
    //       } catch (error) {
    //         console.error('Delete account error:', error);
    //         Toast.error({
    //           title: intl.formatMessage({
    //             id: ETranslations.prime_onekeyid_log_out,
    //           }),
    //         });
    //       }
    //     },
    //   });
    // } catch (error) {
    //   console.error('Delete account preparation error:', error);
    //   Toast.error({
    //     title: intl.formatMessage({
    //       id: ETranslations.prime_onekeyid_log_out,
    //     }),
    //   });
    // }
  }, [intl, navigation, sendEmailOTP]);

  const [checked, changeChecked] = useState(false);

  return (
    <Page scrollEnabled>
      <Page.Header
        headerTitle={intl.formatMessage({
          id: ETranslations.id_delete_onekey_id,
        })}
      />
      <Page.Body>
        <YStack p="$5" gap="$5" alignItems="center">
          <Illustration name="UserAlert" alignSelf="center" />
          <YStack gap="$2" alignItems="center">
            <SizableText size="$headingXl" textAlign="center">
              {intl.formatMessage({
                id: ETranslations.id_delete_onekey_id,
              })}
            </SizableText>
            <SizableText
              size="$bodyMd"
              color="$textSubdued"
              textAlign="center"
              maxWidth={420}
            >
              {intl.formatMessage({
                id: ETranslations.id_delete_onekey_id_desc,
              })}
            </SizableText>
          </YStack>

          {/* Warning Alert */}
          <Alert type="default" w="100%">
            <Markdown>
              {intl.formatMessage({
                id: ETranslations.id_delete_onekey_id_detail_markdown,
              })}
            </Markdown>
          </Alert>
        </YStack>
      </Page.Body>
      <Page.Footer>
        <Page.FooterActions
          onCancelText={intl.formatMessage({
            id: ETranslations.global_cancel,
          })}
          onCancel={() => {
            //
          }}
          onConfirmText={intl.formatMessage({
            id: ETranslations.global_delete,
          })}
          onConfirm={handleDeleteAccount}
          confirmButtonProps={{
            disabled: !checked,
            variant: 'destructive',
          }}
        >
          <Stack
            $md={{
              mb: '$2',
            }}
          >
            <Checkbox
              testID="prime-checkbox"
              value={checked}
              onChange={(value) => {
                changeChecked(!!value);
              }}
              label={intl.formatMessage({
                id: ETranslations.id_delete_double_check,
              })}
            />
          </Stack>
        </Page.FooterActions>
      </Page.Footer>
    </Page>
  );
}
