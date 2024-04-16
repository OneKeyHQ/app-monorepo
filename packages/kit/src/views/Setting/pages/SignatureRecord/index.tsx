import { Page, Tab } from '@onekeyhq/components';

import { ConnectedSites } from './ConnectedSites';
import { SignText } from './SignText';
import { Transactions } from './Transactions';

const SignatureRecordPage = () => (
  <Page>
    <Page.Header title="SignatureRecord" />
    <Page.Body>
      <Tab.Page
        data={[
          { title: 'Transactions', page: Transactions },
          { title: 'Sign Text', page: SignText },
          { title: 'Connected Sites', page: ConnectedSites },
        ]}
        initialScrollIndex={0}
      />
    </Page.Body>
  </Page>
);

export default SignatureRecordPage;
