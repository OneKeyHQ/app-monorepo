import { EDataAvailabilityMode, constants, hash, stark } from 'starknet';

import sdkStarknet from './sdkStarknet';

// Shared public vectors from firmware-pro2 rust/starknet/src/lib.rs. These
// expected hashes are independent of the app's signer and SDK response mocks.
const common = {
  chainId: constants.StarknetChainId.SN_SEPOLIA,
  version: '0x3' as const,
  tip: '0x0',
  paymasterData: [],
  accountDeploymentData: [],
  nonceDataAvailabilityMode: 'L1' as const,
  feeDataAvailabilityMode: 'L1' as const,
};

it('matches the firmware public-transfer hash, including Cairo 1 call encoding', () => {
  const { txHash } = sdkStarknet.calculateInvokeTxHash({
    ...common,
    senderAddress:
      '0x1e8f4310da7e772aff74ea924db190ccdabaf7458db795a6a7d3627eab40c2c',
    nonce: '0x1eb6',
    calls: [
      {
        contractAddress:
          '0x4718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d',
        entrypoint: 'transfer',
        calldata: [
          '0x55f6af4adf180ed0eb59049bf595db50b7175f9249f935b2234125c3ecaebf6',
          '0x1',
          '0x0',
        ],
      },
    ],
    resourceBounds: {
      l1_gas: { max_amount: '0x0', max_price_per_unit: '0xa7049e15f648' },
      l2_gas: { max_amount: '0x1763c0', max_price_per_unit: '0x97b6028d3' },
      l1_data_gas: { max_amount: '0x100', max_price_per_unit: '0xae911e8f7d' },
    },
  });
  expect(txHash).toBe(
    '0x596c17bd765107efcd3da0989bcec2ca41fce56742ed5f1bf0d19b1d203391b',
  );
});

it('matches the firmware deploy-account hash', () => {
  expect(
    sdkStarknet.calculateDeployAccountTxHash({
      ...common,
      contractAddress:
        '0x3ae38f10237af8a96e62f8a1eb4ff951194d98a9467d4415007e1453ca0ca91',
      classHash:
        '0x5b4b537eaa2399e3aa99c4e2e0208ebd6c71bc1467938cd52c798c601e43564',
      addressSalt: '0x1ae21b88a06e2650',
      constructorCalldata: [
        '0x3559d194857a6a5c0ba6e26829c15bda3f06929942a0a4e54b1affbb375c7bd',
      ],
      nonce: '0x0',
      resourceBounds: {
        l1_gas: { max_amount: '0x0', max_price_per_unit: '0xfa670ccced6e' },
        l2_gas: { max_amount: '0x38715c', max_price_per_unit: '0xa0680ef13' },
        l1_data_gas: {
          max_amount: '0x2a0',
          max_price_per_unit: '0x1588b85725c',
        },
      },
    }),
  ).toBe('0x4534eb38003d81e3f0085894db8ab6023402c7c76d8e6c8544853d9f04434fc');
});

it.each([
  [[], '0x27469ecfdadc3a4cef67840e6c078d3c55a5a1040db290da4eaca1b62e62e27'],
  [
    ['0x1', '0x2'],
    '0x3f70bf192026e2a319ca3090ccc1a20741491ae2af2949a960118e3773d3d03',
  ],
])(
  'matches the firmware hash commitment for proof facts %j',
  (proofFacts, expected) => {
    expect(
      hash.calculateInvokeTransactionHash({
        ...common,
        senderAddress: '0x12fd538',
        nonce: '0x9',
        compiledCalldata: ['0x11', '0x26'],
        resourceBounds: {
          l1_gas: { max_amount: BigInt('0x7c9'), max_price_per_unit: 1n },
          l2_gas: { max_amount: 0n, max_price_per_unit: 0n },
          l1_data_gas: { max_amount: 0n, max_price_per_unit: 0n },
        },
        nonceDataAvailabilityMode: stark.intDAM(EDataAvailabilityMode.L1),
        feeDataAvailabilityMode: stark.intDAM(EDataAvailabilityMode.L1),
        proofFacts,
      }),
    ).toBe(expected);
  },
);
