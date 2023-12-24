import { Form, Input, Page, useForm } from '@onekeyhq/components';

import { ChainSelectorTrigger, Tutorials } from '../../Components';

export default function ImportPrivateKey() {
  const form = useForm();

  return (
    <Page>
      <Page.Header title="Import Private Key" />
      <Page.Body px="$5">
        <Form form={form}>
          <Form.Field label="Chain" name="Chain">
            <ChainSelectorTrigger />
          </Form.Field>
          <Form.Field label="Private Key" name="privateKey">
            <Input placeholder="Enter your private key" size="large" />
          </Form.Field>
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
      <Page.Footer onConfirm={() => console.log('confirm')} />
    </Page>
  );
}
