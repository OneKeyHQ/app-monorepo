import { Form, Input, Page, useForm } from '@onekeyhq/components';

import { ChainSelectorTrigger, Tutorials } from '../../Components';

export function ImportAddress() {
  const form = useForm();

  return (
    <Page>
      <Page.Header title="Import Address" />
      <Page.Body px="$5">
        <Form form={form}>
          <Form.Field label="Chain" name="Chain">
            <ChainSelectorTrigger />
          </Form.Field>
          <Form.Field label="Address" name="privateKey">
            <Input
              placeholder="Address or domain name"
              size="large"
              addOns={[
                {
                  iconName: 'ScanOutline',
                  onPress: () => console.log('scan'),
                },
              ]}
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
      <Page.Footer onConfirm={() => console.log('confirm')} />
    </Page>
  );
}

export default ImportAddress;
