import { Page, SizableText } from '@onekeyhq/components';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { AccountSelectorProviderMirror } from '../../../components/AccountSelector';
import { BulkSendHeader } from '../components/BulkSendHeader';

function BaseBulkSendAddressesInput() {
  return (
    <Page>
      <BulkSendHeader />
      <Page.Body>
        <SizableText>Bulk Send Addresses</SizableText>
      </Page.Body>
    </Page>
  );
}

function BulkSendAddressesInput() {
  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.home,
        sceneUrl: '',
      }}
      enabledNum={[0]}
    >
      <BaseBulkSendAddressesInput />
    </AccountSelectorProviderMirror>
  );
}

export default BulkSendAddressesInput;
