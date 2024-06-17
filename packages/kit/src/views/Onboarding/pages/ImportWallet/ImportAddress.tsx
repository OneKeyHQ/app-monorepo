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
import { DeriveTypeSelectorTriggerStaticInput } from '@onekeyhq/kit/src/components/AccountSelector/DeriveTypeSelectorTrigger';
import { useAccountSelectorTrigger } from '@onekeyhq/kit/src/components/AccountSelector/hooks/useAccountSelectorTrigger';
import {
  AddressInput,
  type IAddressInputValue,
  createValidateAddressRule,
} from '@onekeyhq/kit/src/components/AddressInput';
import { watchAccountExcludeNetworkIds } from '@onekeyhq/kit/src/components/ChainSelectorInput/excludeNetworkIds';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useDebounce } from '@onekeyhq/kit/src/hooks/useDebounce';
import { useAccountSelectorActions } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import useScanQrCode from '@onekeyhq/kit/src/views/ScanQrCode/hooks/useScanQrCode';
import type {
  IAccountDeriveInfo,
  IAccountDeriveTypes,
  IValidateGeneralInputParams,
} from '@onekeyhq/kit-bg/src/vaults/types';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { WALLET_TYPE_WATCHING } from '@onekeyhq/shared/src/consts/dbConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import type { IGeneralInputValidation } from '@onekeyhq/shared/types/address';

import { Tutorials } from '../../components';

type IFormValues = {
  networkId?: string;
  deriveType?: IAccountDeriveTypes;
  publicKeyValue: string;
  addressValue: IAddressInputValue;
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
    <Form.Field
      label={intl.formatMessage({
        id: ETranslations.derivation_path,
      })}
      name={fieldName}
    >
      <DeriveTypeSelectorTriggerStaticInput
        networkId={networkId}
        items={deriveInfoItems}
        renderTrigger={({ label }) => (
          <Stack
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
  );
};

function ImportAddress() {
  const intl = useIntl();
  const media = useMedia();
  const navigation = useAppNavigation();
  const validationParams = useMemo<IValidateGeneralInputParams>(
    () => ({
      input: '',
      validateAddress: true,
      validateXpub: true,
    }),
    [],
  );
  const actions = useAccountSelectorActions();
  const [method, setMethod] = useState<EImportMethod>(EImportMethod.Address);
  const {
    activeAccount: { network },
  } = useAccountSelectorTrigger({ num: 0 });
  const { clearText } = useClipboard();
  const form = useForm<IFormValues>({
    values: {
      networkId: network?.id ?? getNetworkIdsMap().btc,
      deriveType: undefined,
      publicKeyValue: '',
      addressValue: { raw: '', resolved: undefined },
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
  const inputTextDebounced = useDebounce(inputText.trim(), 600);
  const validateFn = useCallback(async () => {
    setValue('deriveType', undefined);
    if (inputTextDebounced && networkIdText) {
      const input =
        await backgroundApiProxy.servicePassword.encodeSensitiveText({
          text: inputTextDebounced,
        });
      try {
        const result =
          await backgroundApiProxy.serviceAccount.validateGeneralInputOfImporting(
            {
              ...validationParams,
              input,
              networkId: networkIdText,
            },
          );
        setValidateResult(result);
        console.log('validateGeneralInputOfImporting result', result);
        // TODO: need to replaced by https://github.com/mattermost/react-native-paste-input
        clearText();
      } catch (error) {
        setValidateResult({
          isValid: false,
        });
      }
    } else {
      setValidateResult(undefined);
    }
  }, [
    clearText,
    inputTextDebounced,
    networkIdText,
    setValue,
    validationParams,
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
  const addressValuePending = form.watch('addressValue.pending');

  const isEnable = useMemo(() => {
    if (method === EImportMethod.Address) {
      return !addressValuePending && form.formState.isValid;
    }
    return validateResult?.isValid;
  }, [method, addressValuePending, validateResult, form]);

  return (
    <Page>
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
              excludedNetworkIds={watchAccountExcludeNetworkIds}
            />
          </Form.Field>
          <SegmentControl
            fullWidth
            value={method}
            onChange={(v) => {
              setMethod(v as EImportMethod);
            }}
            options={[
              {
                label: intl.formatMessage({ id: ETranslations.global_address }),
                value: EImportMethod.Address,
              },
              { label: 'Public Key', value: EImportMethod.PublicKey },
            ]}
          />
          {method === EImportMethod.PublicKey ? (
            <>
              <Form.Field label="Public Key" name="publicKeyValue">
                <Input
                  secureTextEntry={false}
                  placeholder="Enter your public key"
                  size={media.gtMd ? 'medium' : 'large'}
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
                  <SizableText color="$textCritical">
                    {intl.formatMessage({
                      id: ETranslations.form_address_error_invalid,
                    })}
                  </SizableText>
                ) : null}
              </>
            </>
          ) : null}
          {method === EImportMethod.Address ? (
            <>
              <Form.Field
                label={intl.formatMessage({ id: ETranslations.global_address })}
                name="addressValue"
                rules={{
                  validate: createValidateAddressRule({
                    defaultErrorMessage: intl.formatMessage({
                      id: ETranslations.send_address_invalid,
                    }),
                  }),
                }}
              >
                <AddressInput networkId={networkIdText ?? ''} />
              </Form.Field>
            </>
          ) : null}
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
      </Page.Body>
      <Page.Footer
        confirmButtonProps={{
          disabled: !isEnable,
        }}
        onConfirm={async () => {
          await form.handleSubmit(async (values) => {
            const data =
              method === EImportMethod.Address
                ? {
                    input: values.addressValue.resolved ?? '',
                    networkId: values.networkId ?? '',
                  }
                : {
                    input: values.publicKeyValue ?? '',
                    networkId: values.networkId ?? '',
                    deriveType: values.deriveType,
                  };

            const r =
              await backgroundApiProxy.serviceAccount.addWatchingAccount(data);

            void actions.current.updateSelectedAccountForSingletonAccount({
              num: 0,
              networkId: values.networkId,
              walletId: WALLET_TYPE_WATCHING,
              othersWalletAccountId: r.accounts[0].id,
            });
            navigation.popStack();
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
