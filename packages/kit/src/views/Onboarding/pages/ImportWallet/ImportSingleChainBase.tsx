import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

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
  useMedia,
} from '@onekeyhq/components';
import {
  type IFormMode,
  type IReValidateMode,
  useForm,
  useFormWatch,
} from '@onekeyhq/components/src/hooks/useForm';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ControlledNetworkSelectorTrigger } from '@onekeyhq/kit/src/components/AccountSelector';
import { DeriveTypeSelectorFormInput } from '@onekeyhq/kit/src/components/AccountSelector/DeriveTypeSelectorTrigger';
import { useAccountSelectorTrigger } from '@onekeyhq/kit/src/components/AccountSelector/hooks/useAccountSelectorTrigger';
import { MAX_LENGTH_ACCOUNT_NAME } from '@onekeyhq/kit/src/components/RenameDialog/renameConsts';
import { useDebounce } from '@onekeyhq/kit/src/hooks/useDebounce';
import useScanQrCodeLazy from '@onekeyhq/kit/src/views/ScanQrCode/hooks/useScanQrCodeLazy';
import type {
  IAccountDeriveTypes,
  IValidateGeneralInputParams,
} from '@onekeyhq/kit-bg/src/vaults/types';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { WALLET_TYPE_IMPORTED } from '@onekeyhq/shared/src/consts/dbConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IGeneralInputValidation } from '@onekeyhq/shared/types/address';

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
  onConfirm: (values: IFormValues) => Promise<void>;
  networkIds?: string[];
}) {
  const intl = useIntl();
  const media = useMedia();
  const {
    activeAccount: { network },
  } = useAccountSelectorTrigger({ num: 0 });
  const { onPasteClearText } = useClipboard();

  const formOptions = useMemo(
    () => ({
      values: {
        networkId:
          network?.id && network.id !== getNetworkIdsMap().onekeyall
            ? network?.id
            : getNetworkIdsMap().btc,
        input: '',
        deriveType: undefined,
        accountName: '',
      },
      mode: 'onChange' as IFormMode,
      reValidateMode: 'onBlur' as IReValidateMode,
    }),
    [network?.id],
  );
  const form = useForm<IFormValues>(formOptions);

  const { control } = form;
  const submittingRef = useRef(false);
  const networkId = useFormWatch({ control, name: 'networkId' });
  const inputText = useFormWatch({ control, name: 'input' });
  const inputTextDebounced = useDebounce(inputText, 600);
  const accountName = useFormWatch({ control, name: 'accountName' });
  const trimmedAccountName = accountName?.trim() ?? '';
  const accountNameDebounced = useDebounce(trimmedAccountName, 600);

  const validationRequest = useMemo(
    () => ({
      networkId,
      input: inputTextDebounced,
      accountName: accountNameDebounced,
    }),
    [networkId, inputTextDebounced, accountNameDebounced],
  );
  const [validation, setValidation] = useState<{
    request: typeof validationRequest;
    result: IGeneralInputValidation;
  }>();

  useEffect(() => {
    let cancelled = false;
    const validate = async () => {
      const { input, networkId: id, accountName: name } = validationRequest;
      if (name) {
        try {
          await backgroundApiProxy.serviceAccount.ensureAccountNameNotDuplicate(
            {
              name,
              walletId: WALLET_TYPE_IMPORTED,
            },
          );
          if (cancelled) return;
          form.clearErrors('accountName');
        } catch (error) {
          if (cancelled) return;
          form.setError('accountName', {
            message: (error as Error)?.message,
          });
        }
      } else {
        form.clearErrors('accountName');
      }

      form.setValue('deriveType', undefined);
      if (!input || !id) return;

      let result: IGeneralInputValidation;
      try {
        const encodedInput =
          await backgroundApiProxy.servicePassword.encodeSensitiveText({
            text: fixInputImportSingleChain(input),
          });
        if (cancelled) return;
        result =
          await backgroundApiProxy.serviceAccount.validateGeneralInputOfImporting(
            {
              ...validationParams,
              input: encodedInput,
              networkId: id,
            },
          );
      } catch {
        result = { isValid: false };
      }
      if (!cancelled) {
        setValidation({ request: validationRequest, result });
      }
    };
    void validate();
    return () => {
      cancelled = true;
    };
  }, [form, validationParams, validationRequest]);

  const validateResult =
    validation?.request.input === inputTextDebounced &&
    validation?.request.networkId === networkId
      ? validation?.result
      : undefined;
  const confirmDisabled =
    validation?.request !== validationRequest ||
    !validateResult?.isValid ||
    inputText !== inputTextDebounced ||
    trimmedAccountName !== accountNameDebounced ||
    Object.keys(form.formState.errors).length > 0;

  const submit = useCallback(async () => {
    const values = form.getValues();
    if (
      confirmDisabled ||
      submittingRef.current ||
      values.input !== validationRequest.input ||
      values.networkId !== validationRequest.networkId ||
      (values.accountName?.trim() ?? '') !== validationRequest.accountName ||
      form.getFieldState('accountName').error
    ) {
      return;
    }

    submittingRef.current = true;
    try {
      await form.handleSubmit(onConfirm)();
    } finally {
      submittingRef.current = false;
    }
  }, [confirmDisabled, form, onConfirm, validationRequest]);

  const formWithSubmit = useMemo(() => ({ ...form, submit }), [form, submit]);

  const { start } = useScanQrCodeLazy();

  return (
    <Page scrollEnabled>
      <Page.Header title={title} />
      <Page.Body px="$5">
        <Form form={formWithSubmit}>
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
              returnKeyType="done"
              onSubmitEditing={submit}
              addOns={[
                {
                  iconName: 'ScanOutline',
                  onPress: async () => {
                    const result = await start({
                      handlers: [],
                      autoExecuteParsedAction: false,
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
                undefinedResultIfReRun={false}
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
              testID="onboarding-input"
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
        confirmButtonProps={{ disabled: confirmDisabled }}
        onConfirm={submit}
      />
    </Page>
  );
}
