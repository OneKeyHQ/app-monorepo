import { useCallback, useMemo, useState } from 'react';

import natsort from 'natsort';
import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import type { ISelectItem, UseFormReturn } from '@onekeyhq/components';
import {
  Button,
  Dialog,
  Form,
  Icon,
  Image,
  ImageCrop,
  Input,
  Select,
  Stack,
  Toast,
  XStack,
  YStack,
  useDialogInstance,
  useForm,
  useInPageDialog,
} from '@onekeyhq/components';
import type {
  IDialogInstance,
  IDialogShowProps,
} from '@onekeyhq/components/src/composite/Dialog/type';
import type { IDBIndexedAccount } from '@onekeyhq/kit-bg/src/dbs/local/types';
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { v4CoinTypeToNetworkId } from '@onekeyhq/kit-bg/src/migrations/v4ToV5Migration/v4CoinTypeToNetworkId';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import type {
  EChangeHistoryContentType,
  EChangeHistoryEntityType,
} from '@onekeyhq/shared/src/types/changeHistory';
import type { IPrimeUserInfo } from '@onekeyhq/shared/types/prime/primeTypes';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { usePromiseResult } from '../../hooks/usePromiseResult';
import {
  OneKeyIdAvatar,
  OneKeyIdFallbackAvatar,
} from '../../views/Setting/pages/OneKeyId/OneKeyIdAvatar';
import { buildChangeHistoryInputAddon } from '../ChangeHistoryDialog/ChangeHistoryDialog';
import { NetworkAvatar } from '../NetworkAvatar';
import { useOneKeyAuth } from '../OneKeyAuth/useOneKeyAuth';

import { MAX_LENGTH_ACCOUNT_NAME } from './renameConsts';

function V4AccountNameSelector({
  onChange,
  indexedAccount,
}: {
  onChange?: (val: string) => void;
  indexedAccount: IDBIndexedAccount;
}) {
  const intl = useIntl();
  const [val] = useState('');
  const { result: items = [] } = usePromiseResult(async () => {
    const { accounts } =
      await backgroundApiProxy.serviceAccount.getAccountsInSameIndexedAccountId(
        {
          indexedAccountId: indexedAccount.id,
        },
      );
    return accounts
      .map((account) => {
        const networkId = v4CoinTypeToNetworkId[account.coinType];
        const item: ISelectItem & {
          networkId?: string;
        } = {
          label: account.name,
          value: account.name,
          leading: <NetworkAvatar networkId={networkId} />,
          networkId,
        };
        return item;
      })
      .sort((a, b) =>
        natsort({ insensitive: true })(a.networkId || '', b.networkId || ''),
      );
  }, [indexedAccount.id]);

  return (
    <Stack pt="$2">
      <Select
        sheetProps={{ snapPoints: [80], snapPointsMode: 'percent' }}
        floatingPanelProps={{
          maxHeight: 272,
        }}
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        renderTrigger={({ value, label, placeholder }) => (
          <Button
            size="small"
            alignSelf="flex-start"
            variant="tertiary"
            iconAfter="ChevronDownSmallOutline"
          >
            {intl.formatMessage({
              id: ETranslations.v4_select_account_name_label,
            })}
          </Button>
        )}
        items={items}
        value={val}
        onChange={onChange}
        title={intl.formatMessage({
          id: ETranslations.v4_select_account_name_label,
        })}
      />
    </Stack>
  );
}

export function RenameInputWithNameSelector({
  value,
  onChange,
  maxLength = 8000,
  description,
  indexedAccount,
  disabledMaxLengthLabel = false,
  nameHistoryInfo,
}: {
  maxLength?: number;
  value?: string;
  onChange?: (val: string) => void;
  description?: string;
  indexedAccount?: IDBIndexedAccount;
  disabledMaxLengthLabel: boolean;
  nameHistoryInfo?: {
    entityId: string;
    entityType: EChangeHistoryEntityType;
    contentType: EChangeHistoryContentType.Name;
  };
}) {
  const intl = useIntl();
  const { result: shouldShowV4AccountNameSelector } =
    usePromiseResult(async () => {
      if (indexedAccount) {
        return backgroundApiProxy.serviceV4Migration.canRenameFromV4AccountName(
          {
            indexedAccount,
          },
        );
      }
      return false;
    }, [indexedAccount]);

  return (
    <>
      <Stack>
        <Input
          size="large"
          $gtMd={{ size: 'medium' }}
          maxLength={maxLength}
          autoFocus
          value={value}
          onChangeText={onChange}
          flex={1}
          addOns={
            nameHistoryInfo?.entityId
              ? [
                  buildChangeHistoryInputAddon({
                    changeHistoryInfo: nameHistoryInfo,
                    onChange,
                  }),
                ]
              : undefined
          }
        />
        {shouldShowV4AccountNameSelector && indexedAccount ? (
          <V4AccountNameSelector
            indexedAccount={indexedAccount}
            onChange={onChange}
          />
        ) : null}
      </Stack>
      <Form.FieldDescription>
        {intl.formatMessage({
          id: ETranslations.account_name_form_helper_text,
        })}
      </Form.FieldDescription>
      {disabledMaxLengthLabel ? null : (
        <Form.FieldDescription textAlign="right">{`${value?.length || 0}/${
          maxLength ?? ''
        }`}</Form.FieldDescription>
      )}
      {description ? (
        <Form.FieldDescription>{description}</Form.FieldDescription>
      ) : null}
    </>
  );
}

export const showRenameDialog = (
  name: string,
  {
    onSubmit,
    maxLength = MAX_LENGTH_ACCOUNT_NAME,
    indexedAccount,
    disabledMaxLengthLabel = false,
    nameHistoryInfo,
    ...dialogProps
  }: IDialogShowProps & {
    indexedAccount?: IDBIndexedAccount;
    maxLength?: number;
    onSubmit: (name: string) => Promise<void>;
    disabledMaxLengthLabel?: boolean;
    nameHistoryInfo?: {
      entityId: string;
      entityType: EChangeHistoryEntityType;
      contentType: EChangeHistoryContentType.Name;
    };
  },
) =>
  Dialog.show({
    title: appLocale.intl.formatMessage({ id: ETranslations.global_rename }),
    renderContent: (
      <Dialog.Form formProps={{ values: { name } }}>
        <Dialog.FormField
          name="name"
          rules={{
            required: {
              value: true,
              message: appLocale.intl.formatMessage({
                id: ETranslations.form_rename_error_empty,
              }),
            },
            validate: (value: string) => {
              if (!value?.trim()) {
                return appLocale.intl.formatMessage({
                  id: ETranslations.form_rename_error_empty,
                });
              }
              return true;
            },
          }}
        >
          <RenameInputWithNameSelector
            maxLength={maxLength}
            indexedAccount={indexedAccount}
            disabledMaxLengthLabel={disabledMaxLengthLabel}
            nameHistoryInfo={nameHistoryInfo}
          />
        </Dialog.FormField>
      </Dialog.Form>
    ),
    onConfirm: async ({ getForm, close }) => {
      const form = getForm();
      await onSubmit(form?.getValues().name);
      // fix toast dropped frames
      await close();
      Toast.success({
        title: appLocale.intl.formatMessage({
          id: ETranslations.feedback_change_saved,
        }),
      });
    },
    ...dialogProps,
  });

interface IPrimeProfileFormValues {
  avatar: string | undefined;
  nickname: string | undefined;
}

function PrimeProfileDialogContent({ user }: { user: IPrimeUserInfo }) {
  const dialogInstance = useDialogInstance();
  const formOption = useMemo(
    () => ({
      defaultValues: {
        avatar: user?.avatar,
        nickname: user?.nickname,
      },
      onSubmit: async (form: UseFormReturn<IPrimeProfileFormValues>) => {
        const values = form.getValues();
        if (values.avatar && values.nickname) {
          try {
            await backgroundApiProxy.servicePrime.updatePrimeUserProfile({
              avatar: values.avatar,
              nickname: values.nickname,
            });
            Toast.success({
              title: appLocale.intl.formatMessage({
                id: ETranslations.feedback_change_saved,
              }),
            });
            await dialogInstance.close();
          } catch (error) {
            console.error(error);
            Toast.error({
              title: appLocale.intl.formatMessage({
                id: ETranslations.global_failed,
              }),
            });
          }
        }
      },
    }),
    [dialogInstance, user?.avatar, user?.nickname],
  );
  const form = useForm<IPrimeProfileFormValues>(formOption);
  const handlePickAvatar = useCallback(async () => {
    const image = await ImageCrop.openPicker({
      width: 240,
      height: 240,
      compressImageQuality: 0.8,
    });
    if (image.data) {
      form.setValue('avatar', image.data);
    }
  }, [form]);
  const userAvatar = form.watch('avatar');
  const handleSubmit = useCallback(
    async ({
      preventClose,
      close,
    }: {
      preventClose: () => void;
      close: IDialogInstance['close'];
    }) => {
      preventClose();
      await form.trigger();
      await form.submit?.();
    },
    [form],
  );
  return (
    <>
      <Form form={form}>
        <YStack gap="$4">
          <XStack jc="center">
            <Stack position="relative" onPress={handlePickAvatar}>
              <Image
                size="$20"
                borderRadius="$full"
                borderWidth={1}
                borderColor="$neutral3"
                source={userAvatar ? { uri: userAvatar } : undefined}
                fallback={<OneKeyIdFallbackAvatar size="$20" />}
              />
              <XStack
                bg="$bg"
                w={30}
                h={30}
                jc="center"
                ai="center"
                borderRadius="$full"
                position="absolute"
                borderWidth={StyleSheet.hairlineWidth}
                borderColor="$bgApp"
                right={0}
                bottom={0}
              >
                <Icon name="EditOutline" size="$4" color="$icon" />
              </XStack>
            </Stack>
          </XStack>
          <Form.Field
            label={appLocale.intl.formatMessage({
              id: ETranslations.settings_nickname,
            })}
            name="nickname"
            rules={{
              required: {
                value: true,
                message: appLocale.intl.formatMessage({
                  id: ETranslations.form_rename_error_empty,
                }),
              },
              validate: (value: string) => {
                if (!value?.trim()) {
                  return appLocale.intl.formatMessage({
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
              addOns={[
                {
                  label: `${form.watch('nickname')?.length || 0}/20`,
                },
              ]}
            />
          </Form.Field>
        </YStack>
      </Form>
      <Dialog.Footer
        showCancelButton={false}
        onConfirm={handleSubmit}
        confirmButtonProps={{
          loading: form.formState.isSubmitting,
        }}
      />
    </>
  );
}

function PrimeProfileDialogContentNotLoggedIn() {
  const { user, isLoggedIn } = useOneKeyAuth();
  return isLoggedIn ? <PrimeProfileDialogContent user={user} /> : null;
}

export const useEditPrimeProfileDialog = () => {
  const intl = useIntl();
  const dialog = useInPageDialog();
  return useCallback(async () => {
    return new Promise<void>((resolve) => {
      dialog.confirm({
        onClose: () => resolve(),
        title: intl.formatMessage({ id: ETranslations.settings_edit_profile }),
        renderContent: <PrimeProfileDialogContentNotLoggedIn />,
      });
    });
  }, [dialog, intl]);
};
