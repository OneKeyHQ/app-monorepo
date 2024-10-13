import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Form,
  Icon,
  Input,
  Page,
  SegmentControl,
  SizableText,
  Stack,
  Toast,
  useClipboard,
  useForm,
  useFormWatch,
  useMedia,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  AccountSelectorProviderMirror,
  ControlledNetworkSelectorTrigger,
} from '@onekeyhq/kit/src/components/AccountSelector';
import { DeriveTypeSelectorFormInput } from '@onekeyhq/kit/src/components/AccountSelector/DeriveTypeSelectorTrigger';
import { useAccountSelectorTrigger } from '@onekeyhq/kit/src/components/AccountSelector/hooks/useAccountSelectorTrigger';
import type { IAddressInputValue } from '@onekeyhq/kit/src/components/AddressInput';
import {
  AddressInput,
  createValidateAddressRule,
} from '@onekeyhq/kit/src/components/AddressInput';
import { MAX_LENGTH_ACCOUNT_NAME } from '@onekeyhq/kit/src/components/RenameDialog/renameConsts';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useDebounce } from '@onekeyhq/kit/src/hooks/useDebounce';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useAccountSelectorActions } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import useScanQrCode from '@onekeyhq/kit/src/views/ScanQrCode/hooks/useScanQrCode';
import type {
  IAccountDeriveInfo,
  IAccountDeriveTypes,
} from '@onekeyhq/kit-bg/src/vaults/types';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { WALLET_TYPE_WATCHING } from '@onekeyhq/shared/src/consts/dbConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import type { IGeneralInputValidation } from '@onekeyhq/shared/types/address';

import { Tutorials } from '../../components';

type IFormValues = {
  networkId?: string;
  deriveType?: IAccountDeriveTypes;
  publicKeyValue: string;
  addressValue: IAddressInputValue;
  accountName?: string;
};

enum EImportMethod {
  Address = 'Address',
  PublicKey = 'PublicKey',
}

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

function ImportAddress() {
  const intl = useIntl();
  const media = useMedia();
  const navigation = useAppNavigation();

  const { result: networksResp } = usePromiseResult(
    async () => {
      const resp =
        await backgroundApiProxy.serviceNetwork.getPublicKeyExportOrWatchingAccountEnabledNetworks();
      const networkIds = resp.map((o) => o.network.id);
      const publicKeyExportEnabledNetworkIds = resp
        .filter((o) => o.publicKeyExportEnabled)
        .map((t) => t.network.id);

      const watchingAccountEnabledNetworkIds = resp
        .filter((o) => o.watchingAccountEnabled)
        .map((t) => t.network.id);
      return {
        networkIds,
        publicKeyExportEnabled: new Set(publicKeyExportEnabledNetworkIds),
        watchingAccountEnabled: new Set(watchingAccountEnabledNetworkIds),
      };
    },
    [],
    {
      initResult: {
        networkIds: [],
        publicKeyExportEnabled: new Set([]),
        watchingAccountEnabled: new Set([]),
      },
    },
  );

  const actions = useAccountSelectorActions();
  const [method, setMethod] = useState<EImportMethod>(EImportMethod.Address);
  const {
    activeAccount: { network },
  } = useAccountSelectorTrigger({ num: 0 });
  const { onPasteClearText } = useClipboard();
  const form = useForm<IFormValues>({
    values: {
      networkId:
        network?.id && network.id !== getNetworkIdsMap().onekeyall
          ? network?.id
          : getNetworkIdsMap().btc,
      deriveType: undefined,
      publicKeyValue: '',
      addressValue: { raw: '', resolved: undefined },
      accountName: '',
    },
    mode: 'onChange',
    reValidateMode: 'onBlur',
  });

  const { setValue, control } = form;
  const [validateResult, setValidateResult] = useState<
    IGeneralInputValidation | undefined
  >();
  const isValidating = useRef<boolean>(false);
  const networkIdText = useFormWatch({ control, name: 'networkId' });
  const inputText = useFormWatch({ control, name: 'publicKeyValue' });
  const addressValue = useFormWatch({ control, name: 'addressValue' });
  const accountName = useFormWatch({ control, name: 'accountName' });

  const inputTextDebounced = useDebounce(inputText.trim(), 600);
  const accountNameDebounced = useDebounce(accountName?.trim() || '', 600);

  const validateFn = useCallback(async () => {
    if (accountNameDebounced) {
      try {
        await backgroundApiProxy.serviceAccount.ensureAccountNameNotDuplicate({
          name: accountNameDebounced,
          walletId: WALLET_TYPE_WATCHING,
        });
        form.clearErrors('accountName');
      } catch (error) {
        form.setError('accountName', {
          message: (error as Error)?.message,
        });
      }
    } else {
      form.clearErrors('accountName');
    }

    setValue('deriveType', undefined);
    if (inputTextDebounced && networkIdText) {
      const input =
        await backgroundApiProxy.servicePassword.encodeSensitiveText({
          text: inputTextDebounced,
        });
      try {
        if (!networksResp.publicKeyExportEnabled.has(networkIdText)) {
          throw new Error(`Network not supported: ${networkIdText}`);
        }
        const result =
          await backgroundApiProxy.serviceAccount.validateGeneralInputOfImporting(
            {
              input,
              networkId: networkIdText,
              validateXpub: true,
            },
          );
        setValidateResult(result);
        console.log('validateGeneralInputOfImporting result', result);
      } catch (error) {
        setValidateResult({
          isValid: false,
        });
      }
    } else {
      setValidateResult(undefined);
    }
  }, [
    accountNameDebounced,
    setValue,
    inputTextDebounced,
    networkIdText,
    form,
    networksResp.publicKeyExportEnabled,
  ]);

  useEffect(() => {
    void (async () => {
      try {
        isValidating.current = true;
        await validateFn();
      } finally {
        isValidating.current = false;
      }
    })();
  }, [validateFn]);

  const { start } = useScanQrCode();

  const deriveTypeValue = form.watch('deriveType');

  const isEnable = useMemo(() => {
    if (Object.values(form.formState.errors).length) {
      return false;
    }
    if (method === EImportMethod.Address) {
      return !addressValue.pending && form.formState.isValid;
    }
    return validateResult?.isValid;
  }, [method, addressValue.pending, validateResult, form.formState]);

  const isKeyExportEnabled = useMemo(
    () =>
      networkIdText && networksResp.publicKeyExportEnabled.has(networkIdText),
    [networkIdText, networksResp.publicKeyExportEnabled],
  );

  const isPublicKeyImport = useMemo(
    () => method === EImportMethod.PublicKey && isKeyExportEnabled,
    [method, isKeyExportEnabled],
  );

  return (
    <Page scrollEnabled>
      <Page.Header
        title={intl.formatMessage({ id: ETranslations.global_import_address })}
      />
      <Page.Body px="$5">
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
      </Page.Body>
      <Page.Footer
        confirmButtonProps={{
          disabled: !isEnable,
        }}
        onConfirm={async () => {
          await form.handleSubmit(async (values) => {
            const data: {
              name?: string;
              input: string;
              networkId: string;
              deriveType?: IAccountDeriveTypes;
              shouldCheckDuplicateName?: boolean;
            } = isPublicKeyImport
              ? {
                  name: values.accountName,
                  input: values.publicKeyValue ?? '',
                  networkId: values.networkId ?? '',
                  deriveType: values.deriveType,
                  shouldCheckDuplicateName: true,
                }
              : {
                  name: values.accountName,
                  input: values.addressValue.resolved ?? '',
                  networkId: values.networkId ?? '',
                  shouldCheckDuplicateName: true,
                };
            const r =
              await backgroundApiProxy.serviceAccount.addWatchingAccount(data);

            const accountId = r?.accounts?.[0]?.id;
            if (accountId) {
              Toast.success({
                title: intl.formatMessage({ id: ETranslations.global_success }),
              });
            }

            void actions.current.updateSelectedAccountForSingletonAccount({
              num: 0,
              networkId: values.networkId,
              walletId: WALLET_TYPE_WATCHING,
              othersWalletAccountId: accountId,
            });
            navigation.popStack();

            defaultLogger.account.wallet.importWallet({
              importMethod: 'address',
            });
          })();
        }}
      />
    </Page>
  );
}

function ImportAddressPage() {
  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.home,
      }}
      enabledNum={[0]}
    >
      <ImportAddress />
    </AccountSelectorProviderMirror>
  );
}

export default ImportAddressPage;
