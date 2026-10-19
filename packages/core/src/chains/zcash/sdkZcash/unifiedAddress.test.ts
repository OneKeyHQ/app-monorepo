import {
  getSupportedZcashUnifiedAddressReceiverTypes,
  isSupportedZcashUnifiedAddress,
} from './unifiedAddress';
import fixtures from './unifiedAddress.fixtures.json';

// Expected results captured from the existing keys WASM using public test data.
// Includes the fixed derivation golden and malformed encodings with valid checksums.
// Revision-zero MUST-understand metadata is explicitly rejected per ZIP-316.
it.each(fixtures)(
  '$name follows the recipient validation policy',
  ({ address, valid }) => {
    expect(isSupportedZcashUnifiedAddress(address)).toBe(valid);
  },
);

it('bounds work for address input', () => {
  expect(isSupportedZcashUnifiedAddress(`u1${'q'.repeat(2000)}`)).toBe(false);
});

it.each([
  ['fixed public mnemonic Orchard golden', [3]],
  ['P2PKH and Orchard', [0, 3]],
  ['P2SH and Orchard', [1, 3]],
] as const)('reads the validated receiver set for %s', (name, receivers) => {
  const fixture = fixtures.find((item) => item.name === name);
  expect(fixture).toBeDefined();
  expect(
    getSupportedZcashUnifiedAddressReceiverTypes(fixture!.address),
  ).toEqual(receivers);
});
