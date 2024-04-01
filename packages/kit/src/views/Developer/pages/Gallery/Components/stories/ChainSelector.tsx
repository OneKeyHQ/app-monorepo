import { useCallback, useState } from 'react';

import { Button, Form, Stack, useForm } from '@onekeyhq/components';
import { ChainSelectorInput } from '@onekeyhq/kit/src/components/ChainSelectorInput';
import useConfigurableChainSelector from '@onekeyhq/kit/src/views/ChainSelector/hooks/useChainSelector';

import { Layout } from './utils/Layout';

const ChainSelectorDemo = () => {
  const [chainId, setChainId] = useState('evm--1');
  const showChainSelector = useConfigurableChainSelector();
  const onPress = useCallback(() => {
    showChainSelector({
      networkIds: ['evm--1', 'btc--0', 'ltc--0', 'doge--0', 'bch--0'],
      defaultNetworkId: chainId,
      title: 'Custom Title',
      onSelect: (o) => setChainId(o.id),
    });
  }, [showChainSelector, chainId]);
  return (
    <Stack space="$2">
      <Button onPress={onPress}>Show Chain Selector</Button>
    </Stack>
  );
};

const ChainSelectorInputDemo = () => {
  const form = useForm({ defaultValues: { networkId: 'btc--0' } });
  return (
    <Stack space="$1">
      <Form form={form}>
        <Form.Field name="networkId">
          <ChainSelectorInput />
        </Form.Field>
      </Form>
      <Button onPress={form.handleSubmit((value) => console.log(value))}>
        Submit
      </Button>
    </Stack>
  );
};

const ChainSelectorGallery = () => (
  <Layout
    description=""
    suggestions={[]}
    boundaryConditions={[]}
    elements={[
      {
        title: 'ChainSelector',
        element: (
          <Stack space="$1">
            <ChainSelectorDemo />
          </Stack>
        ),
      },
      {
        title: 'ChainSelectorInput',
        element: (
          <Stack space="$1">
            <ChainSelectorInputDemo />
          </Stack>
        ),
      },
    ]}
  />
);

export default ChainSelectorGallery;
