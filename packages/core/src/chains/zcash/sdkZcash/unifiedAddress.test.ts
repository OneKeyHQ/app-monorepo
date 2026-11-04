import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import {
  getSupportedZcashUnifiedAddressReceiverTypes,
  isSameZcashOrchardRecipient,
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

it.each([false, true])(
  'validates recipients without typed-array toReversed (Array method absent: %s)',
  (arrayMethodAbsent) => {
    const prototypes: object[] = [Uint8Array.prototype];
    if (arrayMethodAbsent) prototypes.push(Array.prototype);
    const descriptors = prototypes.map((prototype) => ({
      prototype,
      descriptor: Object.getOwnPropertyDescriptor(prototype, 'toReversed'),
    }));
    for (const { prototype } of descriptors) {
      Object.defineProperty(prototype, 'toReversed', {
        configurable: true,
        value: undefined,
      });
    }
    try {
      for (const { name, address, valid } of fixtures) {
        expect({
          name,
          valid: isSupportedZcashUnifiedAddress(address),
        }).toEqual({
          name,
          valid,
        });
      }
    } finally {
      for (const { prototype, descriptor } of descriptors) {
        if (descriptor) {
          Object.defineProperty(prototype, 'toReversed', descriptor);
        } else {
          Reflect.deleteProperty(prototype, 'toReversed');
        }
      }
    }
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

// The chain reads back an Orchard-only address for a payment, never the full address entered.
describe('one Orchard recipient', () => {
  const address = (name: string) => {
    const fixture = fixtures.find((item) => item.name === name);
    if (!fixture) throw new OneKeyLocalError(`missing fixture ${name}`);
    return fixture.address;
  };

  it('matches the full address holding the Orchard receiver it paid', () => {
    expect(
      isSameZcashOrchardRecipient(
        address('derived account 0 orchard'),
        address('derived account 0 all'),
      ),
    ).toBe(true);
  });

  // The apps run the `buffer` package, whose equals() throws on a plain Uint8Array.
  it('matches under the Buffer polyfill the apps run', () => {
    const nodeBuffer = globalThis.Buffer;
    globalThis.Buffer = jest.requireActual<typeof import('buffer')>('buffer/')
      .Buffer as unknown as typeof globalThis.Buffer;
    try {
      expect(
        isSameZcashOrchardRecipient(
          address('derived account 0 orchard'),
          address('derived account 0 all'),
        ),
      ).toBe(true);
    } finally {
      globalThis.Buffer = nodeBuffer;
    }
  });

  it.each([
    ['another account', 'derived account 1 all'],
    ['an invalid address', 'checksum'],
    ['a transparent address', 't1WRWGW7AW7Eu7b1stddJwuSwhAWXYX3UDX'],
  ])('tells %s apart', (_, other) => {
    const fixture = fixtures.find((item) => item.name === other);
    expect(
      isSameZcashOrchardRecipient(
        address('derived account 0 orchard'),
        fixture?.address ?? other,
      ),
    ).toBe(false);
  });
});
