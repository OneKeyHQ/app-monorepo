import { useCallback, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Alert,
  Button,
  Checkbox,
  Dialog,
  Icon,
  Markdown,
  Page,
  SizableText,
  Stack,
  Toast,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useLoginOneKeyId } from '@onekeyhq/kit/src/hooks/useLoginOneKeyId';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { EPrimeEmailOTPScene } from '@onekeyhq/shared/src/consts/primeConsts';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { EReasonForNeedPassword } from '@onekeyhq/shared/types/setting';

import { usePrimeAuthV2 } from '../../hooks/usePrimeAuthV2';

export default function PrimeDeleteAccount() {
  const { logout, user, getAccessToken } = usePrimeAuthV2();
  const navigation = useAppNavigation();
  const intl = useIntl();

  const {
    result: canDeleteAccount,
    isLoading,
    run: checkDeleteEligibility,
  } = usePromiseResult(
    async () => {
      // Check if user has active subscription or other restrictions
      const token = await getAccessToken();
      if (!token) {
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
    [getAccessToken, user, intl],
    {
      watchLoading: true,
    },
  );

  const { sendEmailOTP } = useLoginOneKeyId();

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
        console.log('emailOTP>>>>>>', code, uuid);
        const deleteResult =
          await backgroundApiProxy.servicePrime.apiDeleteAccount({
            uuid,
            emailOTP: code,
          });
        console.log('deleteResult>>>>>>', deleteResult);

        if (!deleteResult?.ok) {
          Toast.error({
            title: intl.formatMessage({
              id: ETranslations.global_failed,
            }),
          });
          return;
        }

        try {
          // logout privy sdk
          await logout();
        } catch (error) {
          console.error('logout error', error);
        }

        //  logout atom states
        await backgroundApiProxy.servicePrime.setPrimePersistAtomNotLoggedIn();

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
  }, [intl, navigation, sendEmailOTP, logout]);

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
          <Dialog.Icon
            icon="ErrorOutline"
            tone="destructive"
            alignSelf="center"
            mb={0}
          />
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
