import { useIntl } from 'react-intl';

import type { UseFormReturn } from '@onekeyhq/components';
import {
  Form,
  Icon,
  Input,
  SegmentControl,
  SizableText,
  Stack,
  useClipboard,
  useMedia,
} from '@onekeyhq/components';
import { ControlledNetworkSelectorTrigger } from '@onekeyhq/kit/src/components/AccountSelector';
import { DeriveTypeSelectorFormInput } from '@onekeyhq/kit/src/components/AccountSelector/DeriveTypeSelectorTrigger';
import {
  AddressInput,
  createValidateAddressRule,
} from '@onekeyhq/kit/src/components/AddressInput';
import { MAX_LENGTH_ACCOUNT_NAME } from '@onekeyhq/kit/src/components/RenameDialog/renameConsts';
import useScanQrCode from '@onekeyhq/kit/src/views/ScanQrCode/hooks/useScanQrCode';
import type { IAccountDeriveInfo } from '@onekeyhq/kit-bg/src/vaults/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { Tutorials } from '../../components';

import { EImportMethod } from './hooks/useImportAddressForm';

import type { IFormValues } from './hooks/useImportAddressForm';

const FormDeriveTypeInput = ({
  networkId,
  deriveInfoItems,
  fieldName,
}: {
  fieldName: string;
  networkId: string;
  deriveInfoItems: IAccountDeriveInfo[];
}) => {
  const intl = useIntl();
  return (
    <Stack mt="$2">
      <Form.Field
        label={intl.formatMessage({
          id: ETranslations.derivation_path,
        })}
        name={fieldName}
      >
        <DeriveTypeSelectorFormInput
          networkId={networkId}
          enabledItems={deriveInfoItems}
          undefinedResultIfReRun={false}
          renderTrigger={({ label, onPress }) => (
            <Stack
              testID="derive-type-input"
              userSelect="none"
              flexDirection="row"
              px="$3.5"
              py="$2.5"
              borderWidth={1}
              borderColor="$borderStrong"
              borderRadius="$3"
              $gtMd={{
                px: '$3',
                py: '$1.5',
                borderRadius: '$2',
              }}
              borderCurve="continuous"
              hoverStyle={{
                bg: '$bgHover',
              }}
              pressStyle={{
                bg: '$bgActive',
              }}
              onPress={onPress}
            >
              <SizableText flex={1}>{label}</SizableText>
              <Icon
                name="ChevronDownSmallOutline"
                color="$iconSubdued"
                mr="$-0.5"
              />
            </Stack>
          )}
        />
      </Form.Field>
    </Stack>
  );
};

interface IImportAddressCoreProps {
  form: UseFormReturn<IFormValues>;
  method: EImportMethod;
  setMethod: (method: EImportMethod) => void;
  networksResp: {
    networkIds: string[];
    publicKeyExportEnabled: Set<string>;
    watchingAccountEnabled: Set<string>;
  };
  isKeyExportEnabled: boolean;
  isPublicKeyImport: boolean;
  validateResult?: {
    isValid: boolean;
    deriveInfoItems?: IAccountDeriveInfo[];
  };
  inputTextDebounced: string;
  networkIdText?: string;
  deriveTypeValue?: any;
}

function ImportAddressCore({
  form,
  method,
  setMethod,
  networksResp,
  isKeyExportEnabled,
  isPublicKeyImport,
  validateResult,
  inputTextDebounced,
  networkIdText,
  deriveTypeValue,
}: IImportAddressCoreProps) {
  const intl = useIntl();
  const media = useMedia();
  const { onPasteClearText } = useClipboard();
  const { start } = useScanQrCode();

  return (
    <Stack flex={1} gap="$4">
      <Form form={form}>
        <Form.Field
          label={intl.formatMessage({ id: ETranslations.global_network })}
          name="networkId"
        >
          <ControlledNetworkSelectorTrigger
            networkIds={networksResp.networkIds}
          />
        </Form.Field>

        {isKeyExportEnabled ? (
          <SegmentControl
            fullWidth
            value={method}
            onChange={(v) => {
              setMethod(v as EImportMethod);
            }}
            options={[
              {
                label: intl.formatMessage({
                  id: ETranslations.global_address,
                }),
                value: EImportMethod.Address,
                testID: 'import-address-address',
              },
              {
                label: intl.formatMessage({
                  id: ETranslations.global_public_key,
                }),
                value: EImportMethod.PublicKey,
                testID: 'import-address-publicKey',
              },
            ]}
          />
        ) : null}
        {isPublicKeyImport ? (
          <>
            <Form.Field
              label={intl.formatMessage({
                id: ETranslations.global_public_key,
              })}
              name="publicKeyValue"
            >
              <Input
                secureTextEntry={false}
                placeholder={intl.formatMessage({
                  id: ETranslations.form_public_key_placeholder,
                })}
                testID="import-address-input"
                size={media.gtMd ? 'medium' : 'large'}
                onPaste={onPasteClearText}
                addOns={[
                  {
                    iconName: 'ScanOutline',
                    onPress: async () => {
                      const result = await start({
                        handlers: [],
                        autoHandleResult: false,
                      });
                      form.setValue('publicKeyValue', result.raw);
                    },
                  },
                ]}
              />
            </Form.Field>
            {validateResult?.deriveInfoItems ? (
              <FormDeriveTypeInput
                fieldName="deriveType"
                networkId={form.getValues().networkId || ''}
                deriveInfoItems={validateResult?.deriveInfoItems || []}
              />
            ) : null}
            <>
              {validateResult &&
              !validateResult?.isValid &&
              inputTextDebounced ? (
                <SizableText size="$bodyMd" color="$textCritical">
                  {intl.formatMessage({
                    id: ETranslations.form_public_key_error_invalid,
                  })}
                </SizableText>
              ) : null}
            </>
          </>
        ) : null}
        {!isPublicKeyImport ? (
          <>
            <Form.Field
              label={intl.formatMessage({ id: ETranslations.global_address })}
              name="addressValue"
              rules={{
                validate: createValidateAddressRule({
                  defaultErrorMessage: intl.formatMessage({
                    id: ETranslations.form_address_error_invalid,
                  }),
                }),
              }}
            >
              <AddressInput
                placeholder={intl.formatMessage({
                  id: ETranslations.form_address_placeholder,
                })}
                networkId={networkIdText ?? ''}
                testID="import-address-input"
              />
            </Form.Field>
          </>
        ) : null}

        <Form.Field
          label={intl.formatMessage({
            id: ETranslations.form_enter_account_name,
          })}
          name="accountName"
        >
          <Input
            maxLength={MAX_LENGTH_ACCOUNT_NAME}
            placeholder={intl.formatMessage({
              id: ETranslations.form_enter_account_name_placeholder,
            })}
          />
        </Form.Field>
      </Form>
      <Tutorials
        list={[
          {
            title: intl.formatMessage({
              id: ETranslations.faq_watched_account,
            }),
            description: intl.formatMessage({
              id: ETranslations.faq_watched_account_desc,
            }),
          },
        ]}
      />

      {process.env.NODE_ENV !== 'production' ? (
        <>
          <SizableText>DEV-ONLY deriveType: {deriveTypeValue}</SizableText>
        </>
      ) : null}
    </Stack>
  );
}

export { ImportAddressCore };
export type { IImportAddressCoreProps };
