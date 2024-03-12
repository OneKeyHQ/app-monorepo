import { Form, Input, Page, useForm } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { ControlledNetworkSelectorTrigger } from '@onekeyhq/kit/src/components/AccountSelector/NetworkSelectorTrigger';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useAccountSelectorActions } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { WALLET_TYPE_WATCHING } from '@onekeyhq/shared/src/consts/dbConsts';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { Tutorials } from '../../components';

function ImportAddress() {
  const form = useForm({
    values: {
      networkId: 'evm--1',
      input: '',
    },
  });
  const navigation = useAppNavigation();

  const actions = useAccountSelectorActions();

  return (
    <Page>
      <Page.Header title="Import Address" />
      <Page.Body px="$5">
        <Form form={form}>
          <Form.Field label="Chain" name="networkId">
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
        onConfirm={async () => {
          const values = form.getValues();
          const r = await backgroundApiProxy.serviceAccount.addWatchingAccount({
            input: values.input,
            networkId: values.networkId,
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
