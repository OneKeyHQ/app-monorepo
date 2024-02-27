import { useState } from 'react';

import { Button, Form, Heading, Stack, useForm } from '@onekeyhq/components';
import { AmountInput } from '@onekeyhq/kit/src/components/AmountInput';

import { Layout } from './utils/Layout';

const WalletWidgetsGallery = () => {
  const [amountValue, setAmountValue] = useState('123');
  console.log(amountValue);
  const form = useForm({ defaultValues: { amount: '' } });
  return (
    <Stack p="$5" bg="$bgApp" h="100%">
      <Stack space="$5" maxWidth="$96">
        <Stack>
          <Heading size="$headingSm" mb="$2.5">
            Example 1 (Send)
          </Heading>
          <AmountInput
            value={amountValue}
            onChange={setAmountValue}
            inputProps={{
              placeholder: '0',
            }}
            tokenSelectorTriggerProps={{
              selectedTokenImageUri:
                'https://onekey-asset.com/assets/btc/btc.png',
              selectedTokenSymbol: 'BTC',
            }}
            balance="0.5"
            enableMaxAmount
            reversible
          />
        </Stack>
        <Stack>
          <Heading size="$headingSm" mb="$2.5">
            Example 2 (Swap - Empty)
          </Heading>
          <AmountInput
            value={amountValue}
            onChange={setAmountValue}
            tokenSelectorTriggerProps={{
              onPress: () => alert('TokenSelectorModal'),
            }}
            inputProps={{
              placeholder: '0',
            }}
          />
        </Stack>

        <Stack>
          <Heading size="$headingSm" mb="$2.5">
            Example 3 (Swap - From Token)
          </Heading>
          <AmountInput
            inputProps={{
              placeholder: '0',
            }}
            tokenSelectorTriggerProps={{
              selectedTokenImageUri:
                'https://cdn.jsdelivr.net/gh/atomiclabs/cryptocurrency-icons@1a63530be6e374711a8554f31b17e4cb92c25fa5/128/color/usdc.png',
              selectedNetworkImageUri:
                'https://cdn.jsdelivr.net/gh/atomiclabs/cryptocurrency-icons@1a63530be6e374711a8554f31b17e4cb92c25fa5/128/color/matic.png',
              selectedTokenSymbol: 'BTC',
              onPress: () => alert('TokenSelectorModal'),
            }}
            balance="0.5"
            enableMaxAmount
          />
        </Stack>
        <Stack>
          <Heading size="$headingSm" mb="$2.5">
            Example 4 (Swap - To Token)
          </Heading>
          <AmountInput
            value="0.5"
            inputProps={{
              placeholder: '0',
              readOnly: true,
            }}
            tokenSelectorTriggerProps={{
              selectedTokenImageUri:
                'https://cdn.jsdelivr.net/gh/atomiclabs/cryptocurrency-icons@1a63530be6e374711a8554f31b17e4cb92c25fa5/128/color/usdc.png',
              selectedNetworkImageUri:
                'https://cdn.jsdelivr.net/gh/atomiclabs/cryptocurrency-icons@1a63530be6e374711a8554f31b17e4cb92c25fa5/128/color/matic.png',
              selectedTokenSymbol: 'BTC',
              onPress: () => alert('TokenSelectorModal'),
            }}
            balance="0.5"
          />
        </Stack>
        <Stack>
          <Heading size="$headingSm" mb="$2.5">
            Example 6 (Error)
          </Heading>
          <AmountInput error />
        </Stack>
        <Stack>
          <Heading size="$headingSm" mb="$2.5">
            Example 7 (Form)
          </Heading>
          <Form form={form}>
            <Form.Field name="amount">
              <AmountInput />
            </Form.Field>
          </Form>
          <Button
            onPress={() => {
              alert(JSON.stringify(form.getValues()));
            }}
          >
            get form values
          </Button>
        </Stack>
      </Stack>
    </Stack>
  );
};

const GalleryLayout = () => (
  <Layout
    description=""
    suggestions={['']}
    boundaryConditions={['']}
    elements={[
      {
        title: 'Default',
        element: <WalletWidgetsGallery />,
      },
    ]}
  />
);
export default GalleryLayout;
