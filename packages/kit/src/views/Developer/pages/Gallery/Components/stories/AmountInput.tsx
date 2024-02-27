/* eslint-disable react-hooks/rules-of-hooks */
/* eslint-disable react/no-unstable-nested-components */
import { useState } from 'react';

import { Button, Form, Stack, useForm } from '@onekeyhq/components';
import { AmountInput } from '@onekeyhq/kit/src/components/AmountInput';

import { Layout } from './utils/Layout';

const GalleryLayout = () => (
  <Layout
    description=""
    suggestions={['']}
    boundaryConditions={['']}
    elements={[
      {
        title: 'Example 1 (Send)',
        element: () => {
          const [amountValue, setAmountValue] = useState('123');
          return (
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
          );
        },
      },
      {
        title: 'Example 2 (Swap - Empty)',
        element: () => {
          const [amountValue, setAmountValue] = useState('123');
          return (
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
          );
        },
      },
      {
        title: 'Example 3 (Swap - From Token)',
        element: (
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
        ),
      },
      {
        title: 'Example 4 (Swap - To Token)',
        element: (
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
        ),
      },
      {
        title: 'Example 5 (Error)',
        element: <AmountInput error />,
      },
      {
        title: 'Example 6 (Form)',
        element: () => {
          const form = useForm({ defaultValues: { amount: '' } });
          return (
            <Stack space="$2">
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
          );
        },
      },
    ]}
  />
);
export default GalleryLayout;
