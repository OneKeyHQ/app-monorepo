import { Form, Input, Page, TextArea, useForm } from '@onekeyhq/components';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import {
  AccountSelectorProviderMirror,
  NetworkSelectorTriggerLegacy,
} from '../../../components/AccountSelector';

function CreateInvoice() {
  const form = useForm();

  return (
    <Page>
      <Page.Header title="Create Invoice" />
      <Page.Body>
        <Form form={form}>
          <AccountSelectorProviderMirror
            config={{
              sceneName: EAccountSelectorSceneName.discover,
              sceneUrl: 'https://www.bing.com',
            }}
            enabledNum={[1]}
          >
            <NetworkSelectorTriggerLegacy key={1} num={1} />
          </AccountSelectorProviderMirror>

          <AccountSelectorProviderMirror
            config={{
              sceneName: EAccountSelectorSceneName.discover,
              sceneUrl: 'https://www.bing.com',
            }}
            enabledNum={[0]}
          >
            <NetworkSelectorTriggerLegacy key={0} num={0} />
          </AccountSelectorProviderMirror>

          <AccountSelectorProviderMirror
            config={{
              sceneName: EAccountSelectorSceneName.home,
            }}
            enabledNum={[1]}
          />
          <Form.Field label="Amount" name="amount" description="$0.00">
            <Input
              placeholder="Enter amount"
              size="large"
              keyboardType="number-pad"
              addOns={[
                {
                  label: 'sats',
                },
              ]}
            />
          </Form.Field>
          <Form.Field
            label="Description"
            description="Enter a brief description for the payment. This helps the recipient identify and record the transaction."
            name="description"
            optional
          >
            <TextArea
              size="large"
              placeholder="e.g., Coffee purchase, Invoice #12345"
            />
          </Form.Field>
        </Form>
      </Page.Body>
    </Page>
  );
}
export { CreateInvoice };
