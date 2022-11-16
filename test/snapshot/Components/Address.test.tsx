import renderer from 'react-test-renderer';

import Address from '@onekeyhq/components/src/Address';

it('renders correctly', () => {
  const tree = renderer
    .create(<Address text="0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B" />)
    .toJSON();
  expect(tree).toMatchInlineSnapshot(`
    <Text
      color="text-default"
    >
      0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B
    </Text>
  `);
});
