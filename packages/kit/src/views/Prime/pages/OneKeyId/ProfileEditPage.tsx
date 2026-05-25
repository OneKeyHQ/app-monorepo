import { memo, useCallback, useEffect, useMemo, useRef } from 'react';

import { useIntl } from 'react-intl';

import type { UseFormReturn } from '@onekeyhq/components';
import {
  Form,
  Icon,
  ImageCrop,
  Input,
  Page,
  Stack,
  Toast,
  XStack,
  YStack,
  resetPrimeModal,
  useForm,
  useUpdateEffect,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useOneKeyAuth } from '@onekeyhq/kit/src/components/OneKeyAuth/useOneKeyAuth';
import { OneKeyIdAvatar } from '@onekeyhq/kit/src/components/OneKeyIdAvatar';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useRouteIsFocused } from '@onekeyhq/kit/src/hooks/useRouteIsFocused';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import { PrimeTestIDs } from '../../testIDs';

interface IPrimeProfileFormValues {
  avatar: string | undefined;
  nickname: string | undefined;
}

const normalizeNickname = (nickname?: string) => nickname?.trim() || '';
const IMAGE_PICKER_CANCELLED_CODE = 'E_PICKER_CANCELLED';

function isImagePickerCancelled(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === IMAGE_PICKER_CANCELLED_CODE
  );
}

function ProfileEditPage() {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const { isLoggedIn, logout, user } = useOneKeyAuth();
  const profileUserId = user?.onekeyUserId || user?.email || '';
  const isFocused = useRouteIsFocused();
  const isMountedRef = useRef(true);
  const isFocusedRef = useRef(isFocused);
  const logoutRef = useRef<() => Promise<void>>(logout);
  const profileUserIdRef = useRef(profileUserId);

  isFocusedRef.current = isFocused;
  logoutRef.current = logout;

  useEffect(
    () => () => {
      isMountedRef.current = false;
    },
    [],
  );

  const handleLoggedOutWhileFocused = useCallback(async () => {
    if (!isLoggedIn && isFocused) {
      await timerUtils.wait(300);
      if (!isMountedRef.current || !isFocusedRef.current) {
        return;
      }
      resetPrimeModal();
      defaultLogger.prime.subscription.onekeyIdLogout({
        reason:
          'OneKeyIdProfileEditPage: is focused and primePersistAtom is not logged in',
      });
      void logoutRef.current();
    }
  }, [isFocused, isLoggedIn]);

  useUpdateEffect(() => {
    void handleLoggedOutWhileFocused();
  }, [handleLoggedOutWhileFocused]);

  const formOption = useMemo(
    () => ({
      defaultValues: {
        avatar: user?.avatar,
        nickname: user?.nickname,
      },
      onSubmit: async (
        formInstance: UseFormReturn<IPrimeProfileFormValues>,
      ) => {
        const formValues = formInstance.getValues();
        const nickname = normalizeNickname(formValues.nickname);
        if (!nickname) {
          return;
        }

        try {
          const success =
            await backgroundApiProxy.servicePrime.updatePrimeUserProfile({
              avatar: formValues.avatar ?? user?.avatar ?? '',
              nickname,
            });

          if (!success) {
            if (!isMountedRef.current || !isFocusedRef.current) {
              return;
            }
            Toast.error({
              title: intl.formatMessage({
                id: ETranslations.global_update_failed,
              }),
            });
            return;
          }

          if (!isMountedRef.current || !isFocusedRef.current) {
            return;
          }
          Toast.success({
            title: intl.formatMessage({
              id: ETranslations.feedback_change_saved,
            }),
          });
          navigation.pop();
        } catch {
          if (!isMountedRef.current || !isFocusedRef.current) {
            return;
          }
          Toast.error({
            title: intl.formatMessage({
              id: ETranslations.global_update_failed,
            }),
          });
        }
      },
    }),
    [intl, navigation, user?.avatar, user?.nickname],
  );

  const form = useForm<IPrimeProfileFormValues>(formOption);
  const userAvatar = form.watch('avatar');
  const profileAvatar = userAvatar ?? user?.avatar;
  const nicknameLength = form.watch('nickname')?.length || 0;

  useEffect(() => {
    const isProfileUserChanged = profileUserIdRef.current !== profileUserId;
    profileUserIdRef.current = profileUserId;

    form.reset(
      {
        avatar: user?.avatar,
        nickname: user?.nickname,
      },
      {
        keepDirtyValues: !isProfileUserChanged,
      },
    );
  }, [form, profileUserId, user?.avatar, user?.nickname]);

  const handlePickAvatar = useCallback(async () => {
    try {
      const image = await ImageCrop.openPicker({
        width: 240,
        height: 240,
        compressImageQuality: 0.8,
      });
      if (image.data) {
        form.setValue('avatar', image.data, { shouldDirty: true });
      }
    } catch (error) {
      if (isImagePickerCancelled(error)) {
        return;
      }
      Toast.error({
        title: intl.formatMessage({
          id: ETranslations.global_update_failed,
        }),
      });
    }
  }, [form, intl]);

  const handleSave = useCallback(async () => {
    const valid = await form.trigger();
    if (!valid) {
      return;
    }
    await form.submit?.();
  }, [form]);

  return (
    <Page>
      <Page.Header
        title={intl.formatMessage({ id: ETranslations.settings_edit_profile })}
      />
      <Page.Body>
        <YStack flex={1} p="$5" gap="$6">
          <Form form={form}>
            <YStack gap="$6">
              <XStack jc="center">
                <Stack position="relative" onPress={handlePickAvatar}>
                  <OneKeyIdAvatar
                    size="$20"
                    source={profileAvatar ? { uri: profileAvatar } : undefined}
                  />
                  <XStack
                    bg="$bg"
                    w={30}
                    h={30}
                    jc="center"
                    ai="center"
                    borderRadius="$full"
                    position="absolute"
                    borderWidth={1}
                    borderColor="$bgApp"
                    right={0}
                    bottom={0}
                  >
                    <Icon name="EditOutline" size="$4" color="$icon" />
                  </XStack>
                </Stack>
              </XStack>
              <Form.Field
                label={intl.formatMessage({
                  id: ETranslations.settings_nickname,
                })}
                name="nickname"
                rules={{
                  validate: (value: string) => {
                    if (!normalizeNickname(value)) {
                      return intl.formatMessage({
                        id: ETranslations.form_rename_error_empty,
                      });
                    }
                    return true;
                  },
                }}
              >
                <Input
                  size="large"
                  $gtMd={{ size: 'medium' }}
                  maxLength={20}
                  autoFocus
                  flex={1}
                  testID={PrimeTestIDs.oneKeyIdProfileNicknameInput}
                  addOns={[
                    {
                      label: `${nicknameLength}/20`,
                    },
                  ]}
                />
              </Form.Field>
            </YStack>
          </Form>
        </YStack>
      </Page.Body>
      <Page.Footer>
        <Page.FooterActions
          onConfirmText={intl.formatMessage({ id: ETranslations.action_save })}
          onConfirm={() => {
            void handleSave();
          }}
          confirmButtonProps={{
            loading: form.formState.isSubmitting,
            testID: PrimeTestIDs.oneKeyIdProfileSaveBtn,
          }}
        />
      </Page.Footer>
    </Page>
  );
}

export default memo(ProfileEditPage);
