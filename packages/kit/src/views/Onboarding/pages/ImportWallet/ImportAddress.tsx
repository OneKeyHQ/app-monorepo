import { useCallback, useEffect, useState } from 'react';

import { Form, Input, Page, useForm, useFormWatch } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { DeriveTypeSelectorTriggerStaticInput } from '@onekeyhq/kit/src/components/AccountSelector/DeriveTypeSelectorTrigger';
import { ControlledNetworkSelectorTrigger } from '@onekeyhq/kit/src/components/AccountSelector/NetworkSelectorTrigger';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useDebounce } from '@onekeyhq/kit/src/hooks/useDebounce';
import { useAccountSelectorActions } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import type { IAccountDeriveTypes } from '@onekeyhq/kit-bg/src/vaults/types';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { WALLET_TYPE_WATCHING } from '@onekeyhq/shared/src/consts/dbConsts';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import type { IGeneralInputValidation } from '@onekeyhq/shared/types/address';

import { Tutorials } from '../../components';

type IFormValues = {
  networkId?: string;
  input?: string;
  deriveType?: IAccountDeriveTypes;
};
function ImportAddress() {
  const form = useForm<IFormValues>({
    values: {
      networkId: getNetworkIdsMap().btc,
      input: '',
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
            validateAddress: true,
            validateXpub: true,
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
      <Page.Header title="Add to Watchlist" />
      <Page.Body px="$5">
        <Form form={form}>
          <Form.Field label="Network" name="networkId">
            <ControlledNetworkSelectorTrigger />
          </Form.Field>
          <Form.Field label="Address" name="input">
            <Input
              placeholder="Address or domain name"
              size="large"
              addOns={[
                {
                  iconName: 'ScanOutline',
                  onPress: () => console.log('scan'),
                },
              ]}
              testID="address"
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
              title: 'What is a watch-only account?',
              description:
                "Watch-only account in OneKey allows monitoring of a specific address but cannot send or receive funds. It's useful for tracking transactions or monitoring holdings.",
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
          const r = await backgroundApiProxy.serviceAccount.addWatchingAccount({
            input: values.input,
            networkId: values.networkId,
            deriveType: values.deriveType,
          });
          console.log(r, values);

          void actions.current.updateSelectedAccount({
            num: 0,
            builder: (v) => ({
              ...v,
              networkId: values.networkId,
              focusedWallet: '$$others',
              walletId: WALLET_TYPE_WATCHING,
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
