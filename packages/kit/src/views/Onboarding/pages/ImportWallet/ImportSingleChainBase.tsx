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
  IAccountDeriveInfoItems,
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

  const { control, setValue } = form;
  const submittingRef = useRef(false);
  const networkId = useFormWatch({ control, name: 'networkId' });
  const inputText = useFormWatch({ control, name: 'input' });
  const normalizedInput = fixInputImportSingleChain(inputText ?? '');
  const inputDebounced = useDebounce(normalizedInput, 600);
  const accountName = useFormWatch({ control, name: 'accountName' });
  const trimmedAccountName = accountName?.trim() ?? '';
  const accountNameDebounced = useDebounce(trimmedAccountName, 600);

  const deriveType = useFormWatch({ control, name: 'deriveType' });

  useEffect(() => {
    setValue('deriveType', undefined);
  }, [networkId, normalizedInput, setValue]);

  const inputToValidate =
    normalizedInput === inputDebounced ? normalizedInput : undefined;
  const validationRequest = useMemo(
    () => ({
      id: Symbol('import key validation'),
      networkId,
      input: inputToValidate,
      params: validationParams,
    }),
    [networkId, inputToValidate, validationParams],
  );
  const [validation, setValidation] = useState<{
    requestId: symbol;
    result: IGeneralInputValidation;
    deriveItems?: IAccountDeriveInfoItems[];
  }>();
  const activeValidationRequestId = useRef<symbol | undefined>(undefined);

  const nameToValidate =
    trimmedAccountName === accountNameDebounced
      ? trimmedAccountName
      : undefined;
  const nameRequest = useMemo(
    () => ({ id: Symbol('account name validation'), name: nameToValidate }),
    [nameToValidate],
  );
  const [checkedNameRequestId, setCheckedNameRequestId] = useState<symbol>();

  useEffect(() => {
    const { id, name } = nameRequest;
    if (name === undefined) return;
    if (!name) {
      form.clearErrors('accountName');
      return;
    }

    let cancelled = false;
    const validateName = async () => {
      try {
        await backgroundApiProxy.serviceAccount.ensureAccountNameNotDuplicate({
          name,
          walletId: WALLET_TYPE_IMPORTED,
        });
        if (cancelled) return;
        form.clearErrors('accountName');
        setCheckedNameRequestId(id);
      } catch (error) {
        if (cancelled) return;
        form.setError('accountName', {
          message: (error as Error)?.message,
        });
      }
    };
    void validateName();
    return () => {
      cancelled = true;
    };
  }, [form, nameRequest]);

  useEffect(() => {
    const {
      id,
      input,
      networkId: requestNetworkId,
      params,
    } = validationRequest;
    if (!input || !requestNetworkId) {
      setValidation(undefined);
      return;
    }

    activeValidationRequestId.current = id;
    let cancelled = false;
    const validateKey = async () => {
      let result: IGeneralInputValidation;
      let deriveItems: IAccountDeriveInfoItems[] | undefined;
      try {
        const encodedInput =
          await backgroundApiProxy.servicePassword.encodeSensitiveText({
            text: input,
          });
        if (cancelled) return;
        result =
          await backgroundApiProxy.serviceAccount.validateGeneralInputOfImporting(
            { ...params, input: encodedInput, networkId: requestNetworkId },
          );
        if (cancelled) return;
        if (result.isValid && result.deriveInfoItems?.length) {
          deriveItems =
            await backgroundApiProxy.serviceNetwork.getDeriveInfoItemsOfNetwork(
              {
                networkId: requestNetworkId,
                enabledItems: result.deriveInfoItems,
              },
            );
        }
      } catch {
        result = { isValid: false };
      }
      if (cancelled) return;

      const currentDeriveType = form.getValues('deriveType');
      if (
        currentDeriveType &&
        !deriveItems?.some((item) => item.value === currentDeriveType)
      ) {
        form.setValue('deriveType', undefined);
      }

      setValidation({ requestId: id, result, deriveItems });
    };
    void validateKey();
    return () => {
      cancelled = true;
      activeValidationRequestId.current = undefined;
    };
  }, [form, validationRequest]);

  const currentValidation =
    validation?.requestId === validationRequest.id ? validation : undefined;
  const validateResult = currentValidation?.result;
  const deriveItems = currentValidation?.deriveItems;
  const matchesValidationRequest = useCallback(
    (values: IFormValues) =>
      fixInputImportSingleChain(values.input ?? '') ===
        validationRequest.input &&
      values.networkId === validationRequest.networkId,
    [validationRequest],
  );
  const guardDeriveTypeChange = useCallback(
    (value: IAccountDeriveTypes) => {
      // The selector can deliver a choice after the form has switched keys.
      if (
        activeValidationRequestId.current !== validationRequest.id ||
        !matchesValidationRequest(form.getValues())
      ) {
        return { defaultPrevented: true };
      }
      return value;
    },
    [form, matchesValidationRequest, validationRequest.id],
  );
  const isDeriveTypeReady = useCallback(
    (value: IAccountDeriveTypes | undefined) =>
      !deriveItems || deriveItems.some((item) => item.value === value),
    [deriveItems],
  );
  const confirmDisabled =
    !validateResult?.isValid ||
    !isDeriveTypeReady(deriveType) ||
    nameRequest.name === undefined ||
    (!!nameRequest.name && checkedNameRequestId !== nameRequest.id) ||
    Object.keys(form.formState.errors).length > 0;

  const submit = useCallback(async () => {
    const values = form.getValues();
    if (
      confirmDisabled ||
      submittingRef.current ||
      !matchesValidationRequest(values) ||
      (values.accountName?.trim() ?? '') !== nameRequest.name ||
      !isDeriveTypeReady(values.deriveType) ||
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
  }, [
    confirmDisabled,
    form,
    isDeriveTypeReady,
    matchesValidationRequest,
    nameRequest.name,
    onConfirm,
  ]);

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

          {validateResult && !validateResult?.isValid && inputDebounced ? (
            <SizableText size="$bodyMd" color="$textCritical">
              {invalidMessage}
            </SizableText>
          ) : null}

          {deriveItems?.length ? (
            <Form.Field
              label={intl.formatMessage({ id: ETranslations.derivation_path })}
              name="deriveType"
            >
              <DeriveTypeSelectorFormInput
                networkId={networkId || ''}
                preloadedItems={deriveItems}
                onChange={guardDeriveTypeChange}
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
