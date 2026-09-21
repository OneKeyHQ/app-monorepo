import { isSupportedZcashUnifiedAddress } from './unifiedAddress';
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
