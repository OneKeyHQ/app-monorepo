import { useCallback, useEffect, useRef, useState } from 'react';

import { trim } from 'lodash';
import { useIntl } from 'react-intl';

import {
  Form,
  Icon,
  Input,
  Page,
  SizableText,
  Stack,
  useClipboard,
  useForm,
  useFormWatch,
  useMedia,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ControlledNetworkSelectorTrigger } from '@onekeyhq/kit/src/components/AccountSelector';
import { DeriveTypeSelectorFormInput } from '@onekeyhq/kit/src/components/AccountSelector/DeriveTypeSelectorTrigger';
import { useAccountSelectorTrigger } from '@onekeyhq/kit/src/components/AccountSelector/hooks/useAccountSelectorTrigger';
import { MAX_LENGTH_ACCOUNT_NAME } from '@onekeyhq/kit/src/components/RenameDialog/renameConsts';
import { useDebounce } from '@onekeyhq/kit/src/hooks/useDebounce';
import useScanQrCode from '@onekeyhq/kit/src/views/ScanQrCode/hooks/useScanQrCode';
import type {
  IAccountDeriveTypes,
  IValidateGeneralInputParams,
} from '@onekeyhq/kit-bg/src/vaults/types';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { WALLET_TYPE_IMPORTED } from '@onekeyhq/shared/src/consts/dbConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IGeneralInputValidation } from '@onekeyhq/shared/types/address';

import type { UseFormReturn } from 'react-hook-form';

type IFormValues = {
  networkId?: string;
  input?: string;
  deriveType?: IAccountDeriveTypes;
  accountName?: string;
};

export const fixInputImportSingleChain = (text: string) => trim(text);

export function ImportSingleChainBase({
  validationParams,
  title,
  inputLabel,
  inputPlaceholder,
  inputIsSecure,
  inputTestID,
  invalidMessage,
  children,
  onConfirm,
  networkIds,
}: {
  validationParams: IValidateGeneralInputParams;
  title: string;
  inputLabel: string;
  inputPlaceholder: string;
  inputIsSecure?: boolean;
  inputTestID?: string;
  invalidMessage: string;
  children?: React.ReactNode;
  onConfirm: (
    form: UseFormReturn<IFormValues, any, undefined>,
  ) => Promise<void>;
  networkIds?: string[];
}) {
  const intl = useIntl();
  const media = useMedia();
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
      input: '',
      deriveType: undefined,
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
  const inputText = useFormWatch({ control, name: 'input' });
  const inputTextDebounced = useDebounce(inputText, 600);

  const accountName = useFormWatch({ control, name: 'accountName' });
  const accountNameDebounced = useDebounce(accountName?.trim() || '', 600);

  const validateFn = useCallback(async () => {
    if (accountNameDebounced) {
      try {
        await backgroundApiProxy.serviceAccount.ensureAccountNameNotDuplicate({
          name: accountNameDebounced,
          walletId: WALLET_TYPE_IMPORTED,
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
          text: fixInputImportSingleChain(inputTextDebounced),
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
    form,
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

  useEffect(() => {
    if (networkIdText) {
      // setValue('input', '');
    }
  }, [networkIdText, setValue]);

  const { start } = useScanQrCode();

  return (
    <Page scrollEnabled>
      <Page.Header title={title} />
      <Page.Body px="$5">
        <Form form={form}>
          <Form.Field
            label={intl.formatMessage({ id: ETranslations.global_network })}
            name="networkId"
          >
            <ControlledNetworkSelectorTrigger networkIds={networkIds} />
          </Form.Field>
          <Form.Field label={inputLabel} name="input">
            <Input
              secureTextEntry={inputIsSecure}
              placeholder={inputPlaceholder}
              size={media.gtMd ? 'medium' : 'large'}
              testID={inputTestID}
              onPaste={onPasteClearText}
              addOns={[
                {
                  iconName: 'ScanOutline',
                  onPress: async () => {
                    const result = await start({
                      handlers: [],
                      autoHandleResult: false,
                    });
                    form.setValue('input', result.raw);
                  },
                },
              ]}
            />
          </Form.Field>

          {validateResult && !validateResult?.isValid && inputTextDebounced ? (
            <SizableText size="$bodyMd" color="$textCritical">
              {invalidMessage}
            </SizableText>
          ) : null}

          {validateResult?.deriveInfoItems ? (
            <Form.Field
              label={intl.formatMessage({ id: ETranslations.derivation_path })}
              name="deriveType"
            >
              <DeriveTypeSelectorFormInput
                networkId={form.getValues().networkId || ''}
                enabledItems={validateResult?.deriveInfoItems || []}
                renderTrigger={({ label, onPress }) => (
                  <Stack
                    testID="wallet-derivation-path-selector-trigger"
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

        {children}
      </Page.Body>
      <Page.Footer
        confirmButtonProps={{
          disabled:
            !validateResult?.isValid ||
            !!Object.values(form.formState.errors).length,
        }}
        onConfirm={async () => onConfirm(form)}
      />
    </Page>
  );
}
