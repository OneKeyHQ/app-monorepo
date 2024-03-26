import { useCallback, useEffect, useState } from 'react';

import {
  Form,
  Input,
  Page,
  useForm,
  useFormWatch,
  useMedia,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { DeriveTypeSelectorTriggerStaticInput } from '@onekeyhq/kit/src/components/AccountSelector/DeriveTypeSelectorTrigger';
import { ControlledNetworkSelectorTrigger } from '@onekeyhq/kit/src/components/AccountSelector/NetworkSelectorTrigger';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useDebounce } from '@onekeyhq/kit/src/hooks/useDebounce';
import { useAccountSelectorActions } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import type { IAccountDeriveTypes } from '@onekeyhq/kit-bg/src/vaults/types';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { WALLET_TYPE_IMPORTED } from '@onekeyhq/shared/src/consts/dbConsts';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import type { IGeneralInputValidation } from '@onekeyhq/shared/types/address';

import { Tutorials } from '../../components';

type IFormValues = {
  networkId?: string;
  input?: string;
  deriveType?: IAccountDeriveTypes;
};
export function ImportPrivateKey() {
  const media = useMedia();
  const form = useForm<IFormValues>({
    values: {
      networkId: getNetworkIdsMap().btc,
      input: '',
      deriveType: undefined,
    },
  });

  const { setValue, control, getValues } = form;
  const [validateResult, setValidateResult] = useState<
    IGeneralInputValidation | undefined
  >();

  const inputText = useFormWatch({ control, name: 'input' });
  const inputTextDebounced = useDebounce(inputText, 600);
  const validateFn = useCallback(async () => {
    setValue('deriveType', undefined);
    const values = getValues();
    if (inputTextDebounced && values.networkId) {
      const input =
        await backgroundApiProxy.servicePassword.encodeSensitiveText({
          text: inputTextDebounced,
        });
      const result =
        await backgroundApiProxy.serviceAccount.validateGeneralInputOfImporting(
          {
            input,
            networkId: values.networkId,
            validateXprvt: true,
            validatePrivateKey: true,
          },
        );
      setValidateResult(result);
      console.log('validateGeneralInputOfImporting result', result);
    } else {
      setValidateResult(undefined);
    }
  }, [getValues, inputTextDebounced, setValue]);

  useEffect(() => {
    void validateFn();
  }, [validateFn]);

  const networkIdText = useFormWatch({ control, name: 'networkId' });
  useEffect(() => {
    if (networkIdText) {
      setValue('input', '');
    }
  }, [networkIdText, setValue]);

  const actions = useAccountSelectorActions();
  const navigation = useAppNavigation();

  return (
    <Page>
      <Page.Header title="Import Private Key" />
      <Page.Body px="$5">
        <Form form={form}>
          <Form.Field label="Network" name="networkId">
            <ControlledNetworkSelectorTrigger />
          </Form.Field>
          <Form.Field label="Private Key" name="input">
            <Input
              secureTextEntry
              placeholder="Enter your private key"
              size={media.gtMd ? 'medium' : 'large'}
              testID="private-key"
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

        <Tutorials
          list={[
            {
              title: 'What is a private key?',
              description:
                'A combination of letters and numbers that is utilized to manage your assets.',
            },
            {
              title: 'Is it safe to enter it into OneKey?',
              description:
                'Yes. It will be stored locally and never leave your device without your explicit permission.',
            },
          ]}
        />
      </Page.Body>
      <Page.Footer
        confirmButtonProps={{
          disabled: !validateResult?.isValid,
        }}
        onConfirm={async () => {
          const values = form.getValues();
          if (!values.input || !values.networkId) {
            return;
          }
          console.log('add imported account', values);
          const input =
            await backgroundApiProxy.servicePassword.encodeSensitiveText({
              text: values.input,
            });
          const r = await backgroundApiProxy.serviceAccount.addImportedAccount({
            input,
            deriveType: values.deriveType,
            networkId: values.networkId,
          });
          console.log(r, values);

          void actions.current.updateSelectedAccount({
            num: 0,
            builder: (v) => ({
              ...v,
              networkId: values.networkId,
              focusedWallet: '$$others',
              walletId: WALLET_TYPE_IMPORTED,
              othersWalletAccountId: r.accounts[0].id,
              indexedAccountId: undefined,
            }),
          });
          navigation.popStack();
        }}
      />
    </Page>
  );
}

function ImportPrivateKeyPage() {
  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.home,
      }}
      enabledNum={[0]}
    >
      <ImportPrivateKey />
    </AccountSelectorProviderMirror>
  );
}

export default ImportPrivateKeyPage;
