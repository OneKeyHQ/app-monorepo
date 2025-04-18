import { type FC, useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import type {
  IFormMode,
  IReValidateMode,
  UseFormReturn,
} from '@onekeyhq/components';
import {
  Checkbox,
  Form,
  IconButton,
  Input,
  Page,
  SizableText,
  Stack,
  XStack,
  YStack,
  useForm,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  AddressInput,
  type IAddressInputValue,
} from '@onekeyhq/kit/src/components/AddressInput';
import { ChainSelectorInput } from '@onekeyhq/kit/src/components/ChainSelectorInput';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import type {
  EChangeHistoryContentType,
  EChangeHistoryEntityType,
} from '@onekeyhq/shared/src/types/changeHistory';
import { formatDate } from '@onekeyhq/shared/src/utils/dateUtils';

import { buildChangeHistoryInputAddon } from '../../../components/ChangeHistoryDialog/ChangeHistoryDialog';
import { usePromiseResult } from '../../../hooks/usePromiseResult';

import type { IAddressItem } from '../type';

type ICreateOrEditContentProps = {
  title?: string;
  item: IAddressItem;
  isSubmitLoading?: boolean;
  disabledAddressEdit?: boolean;
  onSubmit: (item: IAddressItem) => Promise<void>;
  onRemove?: (item: IAddressItem) => void;
  nameHistoryInfo?: {
    entityId: string;
    entityType: EChangeHistoryEntityType.AddressBook;
    contentType: EChangeHistoryContentType.Name;
  };
};

type IFormValues = Omit<IAddressItem, 'address'> & {
  address: IAddressInputValue;
};

function TimeRow({ title, time }: { title: string; time?: number }) {
  if (!time) {
    return null;
  }
  return (
    <XStack jc="space-between">
      <SizableText color="$textSubdued" size="$bodyMd">
        {title}
      </SizableText>
      <SizableText size="$bodyMd">{formatDate(new Date(time))}</SizableText>
    </XStack>
  );
}

export function CreateOrEditContent({
  title,
  item,
  onSubmit,
  onRemove,
  nameHistoryInfo,
  isSubmitLoading,
  disabledAddressEdit,
}: ICreateOrEditContentProps) {
  const intl = useIntl();
  const navigation = useAppNavigation();

  const headerRight = useCallback(
    () =>
      onRemove ? (
        <IconButton
          icon="DeleteOutline"
          variant="tertiary"
          onPress={() => onRemove(item)}
          testID="address-form-remove"
        />
      ) : null,
    [onRemove, item],
  );

  const formOption = useMemo(
    () => ({
      defaultValues: {
        id: item.id,
        networkId: item.networkId,
        name: item.name,
        address: { raw: item.address, resolved: '' } as IAddressInputValue,
        isAllowListed: item.isAllowListed,
      },
      mode: 'onChange' as IFormMode,
      reValidateMode: 'onChange' as IReValidateMode,
      onSubmit: async (form: UseFormReturn<IFormValues>) => {
        const values = form.getValues();
        await onSubmit?.({
          id: values.id,
          name: values.name,
          networkId: values.networkId,
          address: values.address.resolved ?? '',
          isAllowListed: values.isAllowListed ?? false,
        });
      },
    }),
    [
      item.address,
      item.id,
      item.isAllowListed,
      item.name,
      item.networkId,
      onSubmit,
    ],
  );
  const form = useForm<IFormValues>(formOption);
  const networkId = form.watch('networkId');
  const pending = form.watch('address.pending');

  const { result: addressBookEnabledNetworkIds } = usePromiseResult(
    async () => {
      const resp =
        await backgroundApiProxy.serviceNetwork.getAddressBookEnabledNetworks();
      const networkIds = resp.map((o) => o.id);
      return networkIds;
    },
    [],
    { initResult: [] },
  );

  return (
    <Page scrollEnabled>
      <Page.Header title={title} headerRight={headerRight} />
      <Page.Body p="$4">
        <Form form={form}>
          <Form.Field
            label={intl.formatMessage({
              id: ETranslations.address_book_add_address_chain,
            })}
            name="networkId"
            rules={{ required: true }}
            description={
              networkId.startsWith('evm--') ? (
                <SizableText size="$bodyMd" pt="$1.5" color="$textSubdued">
                  {intl.formatMessage({
                    id: ETranslations.address_book_add_address_add_to_evm_chains,
                  })}
                </SizableText>
              ) : null
            }
          >
            <ChainSelectorInput networkIds={addressBookEnabledNetworkIds} />
          </Form.Field>
          <Form.Field
            label={intl.formatMessage({
              id: ETranslations.address_book_add_address_name,
            })}
            name="name"
            rules={{
              required: {
                value: true,
                message: intl.formatMessage({
                  id: ETranslations.address_book_add_address_name_empty_error,
                }),
              },
              maxLength: {
                value: 24,
                message: intl.formatMessage(
                  {
                    id: ETranslations.address_book_add_address_name_length_erro,
                  },
                  { 'num': 24 },
                ),
              },
              validate: async (text: string) => {
                if (!text?.trim()) {
                  return intl.formatMessage({
                    id: ETranslations.address_book_add_address_name_empty_error,
                  });
                }
                const { password } =
                  await backgroundApiProxy.servicePassword.promptPasswordVerify();
                const searched =
                  await backgroundApiProxy.serviceAddressBook.findItem({
                    name: text,
                    password,
                  });
                if (!searched || item.id === searched.id) {
                  return undefined;
                }
                return intl.formatMessage({
                  id: ETranslations.address_book_add_address_name_exists,
                });
              },
            }}
            testID="address-form-name-field"
          >
            <Input
              placeholder={intl.formatMessage({
                id: ETranslations.address_book_add_address_name_required,
              })}
              testID="address-form-name"
              flex={1}
              addOns={
                nameHistoryInfo?.entityId
                  ? [
                      buildChangeHistoryInputAddon({
                        changeHistoryInfo: nameHistoryInfo,
                        onChange: (t) => {
                          form.setValue('name', t);
                        },
                      }),
                    ]
                  : undefined
              }
            />
          </Form.Field>
          <Form.Field
            label={intl.formatMessage({
              id: ETranslations.address_book_add_address_address,
            })}
            name="address"
            rules={{
              validate: async (output: IAddressInputValue) => {
                if (output.pending) {
                  return;
                }
                if (!output.resolved) {
                  return (
                    output.validateError?.message ??
                    intl.formatMessage({
                      id: ETranslations.address_book_add_address_address_invalid_error,
                    })
                  );
                }
                const { password } =
                  await backgroundApiProxy.servicePassword.promptPasswordVerify();
                const searched =
                  await backgroundApiProxy.serviceAddressBook.findItem({
                    address: output.resolved,
                    password,
                  });
                if (!searched || item.id === searched.id) {
                  return undefined;
                }
                return intl.formatMessage({
                  id: ETranslations.address_book_add_address_address_exists,
                });
              },
            }}
            testID="address-form-address-field"
          >
            <AddressInput
              networkId={networkId}
              placeholder={intl.formatMessage({
                id: ETranslations.address_book_add_address_address,
              })}
              editable={!disabledAddressEdit}
              autoError={false}
              testID="address-form-address"
              enableNameResolve
              enableAddressContract
            />
          </Form.Field>
        </Form>
        <YStack gap="$2.5" pt="$5">
          <TimeRow
            title={intl.formatMessage({
              id: ETranslations.address_book_edit_added_on,
            })}
            time={item.createdAt}
          />
          <TimeRow
            title={intl.formatMessage({
              id: ETranslations.address_book_edit_last_edited,
            })}
            time={item.updatedAt}
          />
        </YStack>
      </Page.Body>
      <Page.Footer>
        <Stack
          bg="$bgApp"
          flexDirection="column"
          $gtMd={{ flexDirection: 'row', alignItems: 'center' }}
        >
          <Form form={form}>
            <XStack px="$5">
              <Form.Field name="isAllowListed">
                <Checkbox
                  containerProps={{
                    flex: platformEnv.isNative ? undefined : 1,
                  }}
                  label={intl.formatMessage({
                    id: ETranslations.adress_book_add_address_add_to_allowlist,
                  })}
                  labelProps={
                    {
                      size: '$bodyLgMedium',
                    } as const
                  }
                />
              </Form.Field>
            </XStack>
          </Form>
          <XStack mx="$5" />
          <Page.FooterActions
            flex={platformEnv.isNative ? undefined : 1}
            onConfirmText={intl.formatMessage({
              id: ETranslations.address_book_add_address_button_save,
            })}
            confirmButtonProps={{
              variant: 'primary',
              loading: isSubmitLoading || form.formState.isSubmitting,
              disabled: !form.formState.isValid || pending,
              onPress: form.submit,
              testID: 'address-form-save',
            }}
          />
        </Stack>
      </Page.Footer>
    </Page>
  );
}
