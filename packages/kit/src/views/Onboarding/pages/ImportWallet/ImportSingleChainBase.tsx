import { useCallback, useEffect, useRef, useState } from 'react';

import { trim } from 'lodash';

import {
  Form,
  Input,
  Page,
  SizableText,
  useForm,
  useFormWatch,
  useMedia,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ControlledNetworkSelectorTrigger } from '@onekeyhq/kit/src/components/AccountSelector';
import { DeriveTypeSelectorTriggerStaticInput } from '@onekeyhq/kit/src/components/AccountSelector/DeriveTypeSelectorTrigger';
import { useDebounce } from '@onekeyhq/kit/src/hooks/useDebounce';
import type {
  IAccountDeriveTypes,
  IValidateGeneralInputParams,
} from '@onekeyhq/kit-bg/src/vaults/types';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import type { IGeneralInputValidation } from '@onekeyhq/shared/types/address';

import type { UseFormReturn } from 'react-hook-form';

type IFormValues = {
  networkId?: string;
  input?: string;
  deriveType?: IAccountDeriveTypes;
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
}) {
  const media = useMedia();
  const form = useForm<IFormValues>({
    values: {
      networkId: getNetworkIdsMap().btc,
      input: '',
      deriveType: undefined,
    },
  });

  const { setValue, control } = form;
  const [validateResult, setValidateResult] = useState<
    IGeneralInputValidation | undefined
  >();
  const isValidating = useRef<boolean>(false);
  const networkIdText = useFormWatch({ control, name: 'networkId' });
  const inputText = useFormWatch({ control, name: 'input' });
  const inputTextDebounced = useDebounce(inputText, 600);
  const validateFn = useCallback(async () => {
    setValue('deriveType', undefined);
    console.log('🥺', inputTextDebounced, networkIdText);
    if (inputTextDebounced && networkIdText) {
      const input =
        await backgroundApiProxy.servicePassword.encodeSensitiveText({
          text: fixInputImportSingleChain(inputTextDebounced),
        });
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
    } else {
      setValidateResult(undefined);
    }
  }, [inputTextDebounced, networkIdText, setValue, validationParams]);

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

  return (
    <Page>
      <Page.Header title={title} />
      <Page.Body px="$5">
        <Form form={form}>
          <Form.Field label="Network" name="networkId">
            <ControlledNetworkSelectorTrigger />
          </Form.Field>
          <Form.Field label={inputLabel} name="input">
            <Input
              secureTextEntry={inputIsSecure}
              placeholder={inputPlaceholder}
              size={media.gtMd ? 'medium' : 'large'}
              testID={inputTestID}
              addOns={[
                {
                  iconName: 'ScanOutline',
                  onPress: () => console.log('scan'),
                },
              ]}
            />
          </Form.Field>
          {validateResult?.deriveInfoItems ? (
            <Form.Field label="Derivation Path" name="deriveType">
              <DeriveTypeSelectorTriggerStaticInput
                networkId={form.getValues().networkId || ''}
                items={validateResult?.deriveInfoItems || []}
              />
            </Form.Field>
          ) : null}
        </Form>

        {validateResult && !validateResult?.isValid && inputTextDebounced ? (
          <SizableText color="$textCritical">{invalidMessage}</SizableText>
        ) : null}

        {children}
      </Page.Body>
      <Page.Footer
        confirmButtonProps={{
          disabled: !validateResult?.isValid,
        }}
        onConfirm={async () => onConfirm(form)}
      />
    </Page>
  );
}
