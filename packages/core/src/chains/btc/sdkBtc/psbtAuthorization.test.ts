/*
yarn jest packages/core/src/chains/btc/sdkBtc/psbtAuthorization.test.ts

OK-67209 / OK-67286: a dapp PSBT could hide the real transfer behind display
heuristics and have it signed with a sighash that does not commit to the
outputs the confirm page showed.
*/
import { getBitcoinECPair, initBitcoinEcc } from '.';

import { Psbt, Transaction, payments } from 'bitcoinjs-lib';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { getBtcForkNetwork } from './networks';
import {
  EBtcPsbtSighashFamily,
  buildBtcPsbtAuthorization,
  buildBtcPsbtDisplayTransfers,
  classifyBtcSighashType,
  dropBtcPsbtSignaturesOutsideRequest,
  findBtcPsbtSignPolicyViolation,
  getBtcPsbtSighashFamily,
} from './psbtAuthorization';

import type { networks } from 'bitcoinjs-lib';

const psbtNetwork: networks.Network = getBtcForkNetwork('tbtc');

const TXID_VICTIM = '11'.repeat(32);
const TXID_FAKE = '22'.repeat(32);

const SIGHASH_SINGLE_ANYONECANPAY =
  Transaction.SIGHASH_SINGLE | Transaction.SIGHASH_ANYONECANPAY;
const SIGHASH_ALL_ANYONECANPAY =
  Transaction.SIGHASH_ALL | Transaction.SIGHASH_ANYONECANPAY;
const SIGHASH_NONE_ANYONECANPAY =
  Transaction.SIGHASH_NONE | Transaction.SIGHASH_ANYONECANPAY;

initBitcoinEcc();
const ECPair = getBitcoinECPair();

function makeP2wpkh() {
  const keyPair = ECPair.makeRandom({ network: psbtNetwork });
  const { address, output } = payments.p2wpkh({
    pubkey: keyPair.publicKey,
    network: psbtNetwork,
  });
  if (!address || !output) {
    throw new OneKeyLocalError('failed to build p2wpkh test fixture');
  }
  return { address, script: output, keyPair };
}

type ITestInput = {
  txid: string;
  vout: number;
  value: bigint;
  script: Uint8Array;
  sighashType?: number;
};

function buildPsbt({
  inputs,
  outputs,
}: {
  inputs: ITestInput[];
  outputs: Array<{ script: Uint8Array; value: bigint }>;
}): Psbt {
  const psbt = new Psbt({ network: psbtNetwork });
  inputs.forEach((input) => {
    psbt.addInput({
      hash: input.txid,
      index: input.vout,
      witnessUtxo: { script: input.script, value: input.value },
      ...(input.sighashType === undefined
        ? {}
        : { sighashType: input.sighashType }),
    });
  });
  outputs.forEach((output) => {
    psbt.addOutput({ script: output.script, value: output.value });
  });
  return psbt;
}

const victim = makeP2wpkh();
const attacker = makeP2wpkh();
const decoy = makeP2wpkh();

// The PSBT from the report: the victim input is declared
// SIGHASH_SINGLE|ANYONECANPAY, an unsigned input that does not exist on chain
// mirrors the attacker output, and a decoy plus change sit after it.
function buildReportedPsbt() {
  return buildPsbt({
    inputs: [
      {
        txid: TXID_VICTIM,
        vout: 3,
        value: 1_457_639n,
        script: victim.script,
        sighashType: SIGHASH_SINGLE_ANYONECANPAY,
      },
      { txid: TXID_FAKE, vout: 0, value: 1_455_639n, script: attacker.script },
    ],
    outputs: [
      { script: attacker.script, value: 1_455_639n },
      { script: decoy.script, value: 1000n },
      { script: victim.script, value: 1_454_639n },
    ],
  });
}

// Seller side of a marketplace listing: one input, one output paying the
// seller, fee inputs added later by the buyer.
function buildListingPsbt() {
  return buildPsbt({
    inputs: [
      {
        txid: TXID_VICTIM,
        vout: 0,
        value: 546n,
        script: victim.script,
        sighashType: SIGHASH_SINGLE_ANYONECANPAY,
      },
    ],
    outputs: [{ script: victim.script, value: 1_000_000n }],
  });
}

const victimInput = (sighashType?: number): ITestInput => ({
  txid: TXID_VICTIM,
  vout: 0,
  value: 100_000n,
  script: victim.script,
  sighashType,
});

describe('classifyBtcSighashType', () => {
  it.each([
    [undefined, EBtcPsbtSighashFamily.All, false],
    [Transaction.SIGHASH_DEFAULT, EBtcPsbtSighashFamily.All, false],
    [Transaction.SIGHASH_ALL, EBtcPsbtSighashFamily.All, false],
    [SIGHASH_ALL_ANYONECANPAY, EBtcPsbtSighashFamily.All, true],
    [Transaction.SIGHASH_SINGLE, EBtcPsbtSighashFamily.Single, false],
    [SIGHASH_SINGLE_ANYONECANPAY, EBtcPsbtSighashFamily.Single, true],
  ])('classifies %s', (sighashType, family, anyoneCanPay) => {
    expect(classifyBtcSighashType(sighashType)).toEqual({
      family,
      anyoneCanPay,
    });
  });

  it.each([
    Transaction.SIGHASH_NONE,
    Transaction.SIGHASH_NONE | Transaction.SIGHASH_ANYONECANPAY,
    0x04,
    0x41,
    0x80,
    0xff,
  ])('has no class for %s', (sighashType) => {
    expect(classifyBtcSighashType(sighashType)).toBeUndefined();
  });
});

describe('findBtcPsbtSignPolicyViolation', () => {
  const find = (psbt: Psbt, indexes: number[], ownedAddresses?: string[]) =>
    findBtcPsbtSignPolicyViolation({
      psbt,
      psbtNetwork,
      inputsToSign: indexes.map((index) => ({ index })),
      ownedAddresses,
    });

  it.each([undefined, Transaction.SIGHASH_ALL, SIGHASH_ALL_ANYONECANPAY])(
    'allows a signature that commits to every output: %s',
    (sighashType) => {
      const psbt = buildPsbt({
        inputs: [victimInput(sighashType)],
        outputs: [
          { script: attacker.script, value: 50_000n },
          { script: victim.script, value: 49_000n },
        ],
      });
      expect(find(psbt, [0], [victim.address])).toBeUndefined();
    },
  );

  it('rejects SIGHASH_NONE', () => {
    const psbt = buildPsbt({
      inputs: [victimInput(Transaction.SIGHASH_NONE)],
      outputs: [{ script: victim.script, value: 99_000n }],
    });
    expect(find(psbt, [0], [victim.address])).toEqual({
      index: 0,
      message: 'SIGHASH_NONE is not supported for input 0',
    });
  });

  it('rejects a sighash byte outside the supported set', () => {
    const psbt = buildPsbt({
      inputs: [victimInput(0x04)],
      outputs: [{ script: victim.script, value: 99_000n }],
    });
    expect(find(psbt, [0], [victim.address])).toEqual({
      index: 0,
      message: 'Sighash type 0x04 is not supported for input 0',
    });
  });

  it('rejects signing inputs with different output commitments', () => {
    const psbt = buildPsbt({
      inputs: [
        victimInput(Transaction.SIGHASH_ALL),
        {
          txid: TXID_VICTIM,
          vout: 1,
          value: 546n,
          script: victim.script,
          sighashType: SIGHASH_SINGLE_ANYONECANPAY,
        },
      ],
      outputs: [
        { script: attacker.script, value: 50_000n },
        { script: victim.script, value: 49_000n },
      ],
    });
    expect(find(psbt, [0, 1], [victim.address])?.index).toBe(1);
  });

  it('rejects SIGHASH_SINGLE on an input that has no matching output', () => {
    const psbt = buildPsbt({
      inputs: [
        { txid: TXID_FAKE, vout: 0, value: 1000n, script: attacker.script },
        victimInput(SIGHASH_SINGLE_ANYONECANPAY),
      ],
      outputs: [{ script: victim.script, value: 99_000n }],
    });
    expect(find(psbt, [1], [victim.address])).toEqual({
      index: 1,
      message: 'SIGHASH_SINGLE input 1 has no matching output',
    });
  });

  it('rejects the reported PSBT: the only committed output pays the attacker', () => {
    expect(find(buildReportedPsbt(), [0], [victim.address])).toEqual({
      index: 0,
      message:
        'SIGHASH_SINGLE input 0 must pay its matching output to the signing account',
    });
  });

  it('rejects a SIGHASH_SINGLE payment whose change is left uncommitted', () => {
    // No fake input needed: output 0 is shown honestly, the change in output 1
    // can be swapped for an attacker output after signing.
    const psbt = buildPsbt({
      inputs: [victimInput(Transaction.SIGHASH_SINGLE)],
      outputs: [
        { script: attacker.script, value: 1000n },
        { script: victim.script, value: 98_000n },
      ],
    });
    expect(find(psbt, [0], [victim.address])?.index).toBe(0);
  });

  it('allows a marketplace listing', () => {
    expect(find(buildListingPsbt(), [0], [victim.address])).toBeUndefined();
  });

  it('rejects an input index requested more than once', () => {
    // Summarized per request entry, the listing would show its one payout
    // twice.
    expect(find(buildListingPsbt(), [0, 0], [victim.address])).toEqual({
      index: 0,
      message: 'Input 0 is requested for signing more than once',
    });
    const payment = buildPsbt({
      inputs: [victimInput()],
      outputs: [{ script: attacker.script, value: 99_000n }],
    });
    expect(find(payment, [0, 0])?.index).toBe(0);
  });

  it('rejects SIGHASH_SINGLE for a signer that is not bound to the request', () => {
    const findUnbound = (psbt: Psbt) =>
      findBtcPsbtSignPolicyViolation({
        psbt,
        psbtNetwork,
        inputsToSign: [{ index: 0 }],
        ownedAddresses: [victim.address],
        isSignerBoundToRequest: false,
      });
    expect(findUnbound(buildListingPsbt())).toEqual({
      index: 0,
      message: 'SIGHASH_SINGLE is not supported by this wallet for input 0',
    });
    const payment = buildPsbt({
      inputs: [victimInput(SIGHASH_ALL_ANYONECANPAY)],
      outputs: [{ script: attacker.script, value: 99_000n }],
    });
    expect(findUnbound(payment)).toBeUndefined();
  });

  it('checks sighash types only when the owned addresses are not supplied', () => {
    expect(find(buildReportedPsbt(), [0])).toBeUndefined();
    const psbt = buildPsbt({
      inputs: [victimInput(0x04)],
      outputs: [{ script: victim.script, value: 99_000n }],
    });
    expect(find(psbt, [0])?.index).toBe(0);
  });

  it('ignores the sighash of inputs it is not asked to sign', () => {
    const psbt = buildPsbt({
      inputs: [
        victimInput(),
        {
          txid: TXID_FAKE,
          vout: 0,
          value: 1000n,
          script: attacker.script,
          sighashType: Transaction.SIGHASH_NONE,
        },
      ],
      outputs: [{ script: victim.script, value: 99_000n }],
    });
    expect(find(psbt, [0], [victim.address])).toBeUndefined();
  });

  it.each([
    ['a string alias of an input', '0'],
    ['an array alias of an input', [0]],
    ['a negative index', -1],
    ['an index past the last input', 1],
    ['a fractional index', 0.5],
  ])('rejects %s as an input index', (_name, index) => {
    // The index is dapp-supplied. '0' and [0] read input 0 without being
    // equal to the number 0, so a repeat written that way is not seen as one.
    expect(
      findBtcPsbtSignPolicyViolation({
        psbt: buildListingPsbt(),
        psbtNetwork,
        inputsToSign: [{ index: index as unknown as number }],
        ownedAddresses: [victim.address],
      }),
    ).toEqual({
      index,
      message: `Input index ${String(index)} is not a valid input of this PSBT`,
    });
  });

  it('does not let an alias repeat an input index', () => {
    expect(
      findBtcPsbtSignPolicyViolation({
        psbt: buildListingPsbt(),
        psbtNetwork,
        inputsToSign: [{ index: 0 }, { index: '0' as unknown as number }],
        ownedAddresses: [victim.address],
      }),
    ).toBeDefined();
  });

  describe('for a signer that is not bound to the request', () => {
    // Input 0 is requested and commits to every output. Input 1 is not
    // requested; a device that signs whatever it holds a key for may sign it
    // too, with the sighash type it declares.
    const buildWithInputOutsideRequest = ({
      script,
      sighashType,
    }: {
      script: Uint8Array;
      sighashType?: number;
    }) =>
      buildPsbt({
        inputs: [
          victimInput(),
          {
            txid: TXID_VICTIM,
            vout: 1,
            value: 5_000_000n,
            script,
            sighashType,
          },
        ],
        outputs: [
          { script: attacker.script, value: 50_000n },
          { script: victim.script, value: 5_049_000n },
        ],
      });
    const findUnbound = (psbt: Psbt, ownedAddresses?: string[]) =>
      findBtcPsbtSignPolicyViolation({
        psbt,
        psbtNetwork,
        inputsToSign: [{ index: 0 }],
        ownedAddresses,
        isSignerBoundToRequest: false,
      });

    it.each([
      [Transaction.SIGHASH_NONE, '0x02'],
      [SIGHASH_NONE_ANYONECANPAY, '0x82'],
      [Transaction.SIGHASH_SINGLE, '0x03'],
      [SIGHASH_SINGLE_ANYONECANPAY, '0x83'],
      [0x04, '0x04'],
    ])(
      'rejects an account input outside the request that declares sighash %i',
      (sighashType, hex) => {
        const psbt = buildWithInputOutsideRequest({
          script: victim.script,
          sighashType,
        });
        expect(findUnbound(psbt, [victim.address])).toEqual({
          index: 1,
          message: `Input 1 is outside the signing request and must not declare sighash type ${hex}`,
        });
      },
    );

    it.each([undefined, Transaction.SIGHASH_ALL, SIGHASH_ALL_ANYONECANPAY])(
      'allows an account input outside the request that commits to every output: %s',
      (sighashType) => {
        const psbt = buildWithInputOutsideRequest({
          script: victim.script,
          sighashType,
        });
        expect(findUnbound(psbt, [victim.address])).toBeUndefined();
      },
    );

    it("allows another party's input outside the request, whatever it declares", () => {
      // The seller input of a marketplace purchase: the signer holds no key
      // for it.
      const psbt = buildWithInputOutsideRequest({
        script: attacker.script,
        sighashType: SIGHASH_SINGLE_ANYONECANPAY,
      });
      expect(findUnbound(psbt, [victim.address])).toBeUndefined();
    });

    it('allows an account input outside the request that is already finalized', () => {
      const psbt = buildWithInputOutsideRequest({
        script: victim.script,
        sighashType: SIGHASH_NONE_ANYONECANPAY,
      });
      psbt.data.inputs[1].finalScriptWitness = Buffer.from('00', 'hex');
      expect(findUnbound(psbt, [victim.address])).toBeUndefined();
    });

    it('treats every unsigned input outside the request as signable when the account addresses are unknown', () => {
      const psbt = buildWithInputOutsideRequest({
        script: attacker.script,
        sighashType: SIGHASH_SINGLE_ANYONECANPAY,
      });
      expect(findUnbound(psbt)?.index).toBe(1);
    });

    it('is not applied to a signer that signs the requested inputs only', () => {
      const psbt = buildWithInputOutsideRequest({
        script: victim.script,
        sighashType: SIGHASH_NONE_ANYONECANPAY,
      });
      expect(find(psbt, [0], [victim.address])).toBeUndefined();
    });
  });
});

describe('dropBtcPsbtSignaturesOutsideRequest', () => {
  // Both inputs belong to the account; only input 0 is requested.
  const buildTwoInputPsbt = () =>
    buildPsbt({
      inputs: [
        victimInput(),
        {
          txid: TXID_VICTIM,
          vout: 1,
          value: 5_000_000n,
          script: victim.script,
          sighashType: SIGHASH_NONE_ANYONECANPAY,
        },
      ],
      outputs: [
        { script: attacker.script, value: 50_000n },
        { script: victim.script, value: 5_049_000n },
      ],
    });
  const drop = (unsignedPsbt: Psbt, signedPsbtHex: string) =>
    dropBtcPsbtSignaturesOutsideRequest({
      unsignedPsbt,
      signedPsbtHex,
      inputsToSign: [{ index: 0 }],
      network: psbtNetwork,
    });

  it('drops a signature the device added to an input outside the request', () => {
    const unsignedPsbt = buildTwoInputPsbt();
    const deviceResult = unsignedPsbt.clone();
    deviceResult.signInput(0, victim.keyPair);
    deviceResult.signInput(1, victim.keyPair, [SIGHASH_NONE_ANYONECANPAY]);

    const released = Psbt.fromHex(drop(unsignedPsbt, deviceResult.toHex()), {
      network: psbtNetwork,
    });
    expect(released.data.inputs[0].partialSig).toHaveLength(1);
    expect(released.data.inputs[1].partialSig).toBeUndefined();
  });

  it('returns the device result untouched when only requested inputs were signed', () => {
    const unsignedPsbt = buildTwoInputPsbt();
    const deviceResult = unsignedPsbt.clone();
    deviceResult.signInput(0, victim.keyPair);
    const deviceResultHex = deviceResult.toHex();

    expect(drop(unsignedPsbt, deviceResultHex)).toBe(deviceResultHex);
  });

  it('keeps a signature an input outside the request already carried', () => {
    const unsignedPsbt = buildTwoInputPsbt();
    unsignedPsbt.signInput(1, victim.keyPair, [SIGHASH_NONE_ANYONECANPAY]);
    const deviceResult = unsignedPsbt.clone();
    deviceResult.signInput(0, victim.keyPair);
    const deviceResultHex = deviceResult.toHex();

    expect(drop(unsignedPsbt, deviceResultHex)).toBe(deviceResultHex);
  });
});

describe('getBtcPsbtSighashFamily', () => {
  it('is Single as soon as one signed input is SIGHASH_SINGLE', () => {
    expect(
      getBtcPsbtSighashFamily({
        psbt: buildListingPsbt(),
        inputsToSign: [{ index: 0 }],
      }),
    ).toBe(EBtcPsbtSighashFamily.Single);
  });

  it('is All when the signed inputs commit to every output', () => {
    const psbt = buildPsbt({
      inputs: [
        victimInput(),
        {
          txid: TXID_FAKE,
          vout: 0,
          value: 546n,
          script: attacker.script,
          sighashType: SIGHASH_SINGLE_ANYONECANPAY,
        },
      ],
      outputs: [{ script: victim.script, value: 99_000n }],
    });
    // Input 1 is another party's and is not signed here.
    expect(
      getBtcPsbtSighashFamily({ psbt, inputsToSign: [{ index: 0 }] }),
    ).toBe(EBtcPsbtSighashFamily.All);
  });
});

describe('buildBtcPsbtAuthorization', () => {
  const build = (psbt: Psbt, indexes: number[]) =>
    buildBtcPsbtAuthorization({
      psbt,
      psbtNetwork,
      inputsToSign: indexes.map((index) => ({ index })),
      ownedAddresses: [victim.address],
    });

  it('throws for the reported PSBT', () => {
    expect(() => build(buildReportedPsbt(), [0])).toThrow(
      'SIGHASH_SINGLE input 0 must pay its matching output to the signing account',
    );
  });

  it('throws instead of listing a repeated input twice', () => {
    expect(() => build(buildListingPsbt(), [0, 0])).toThrow(
      'Input 0 is requested for signing more than once',
    );
  });

  it('pairs each SIGHASH_SINGLE input with the one output it commits to', () => {
    expect(build(buildListingPsbt(), [0])).toEqual({
      family: EBtcPsbtSighashFamily.Single,
      hasAnyoneCanPay: true,
      signedInputs: [
        {
          index: 0,
          value: '546',
          address: victim.address,
          committedOutput: {
            index: 0,
            address: victim.address,
            value: '1000000',
          },
        },
      ],
    });
  });

  it('reports no single committed output when every output is committed', () => {
    const psbt = buildPsbt({
      inputs: [victimInput(SIGHASH_ALL_ANYONECANPAY)],
      outputs: [
        { script: attacker.script, value: 50_000n },
        { script: victim.script, value: 49_000n },
      ],
    });
    expect(build(psbt, [0])).toEqual({
      family: EBtcPsbtSighashFamily.All,
      hasAnyoneCanPay: true,
      signedInputs: [{ index: 0, value: '100000', address: victim.address }],
    });
  });
});

describe('buildBtcPsbtDisplayTransfers', () => {
  const allAuthorization = {
    family: EBtcPsbtSighashFamily.All,
    hasAnyoneCanPay: false,
    signedInputs: [{ index: 0, value: '100000', address: victim.address }],
  };
  const change = { isChange: true };

  it('shows an external output even when an unsigned input mirrors it', () => {
    // The mirrored input used to mark the attacker output as inscription
    // structure and drop it from the confirm page.
    expect(
      buildBtcPsbtDisplayTransfers({
        authorization: allAuthorization,
        outputs: [
          { address: attacker.address, value: '1455639' },
          { address: decoy.address, value: '1000' },
          { address: victim.address, value: '1454639', payload: change },
        ],
      }),
    ).toEqual({
      sends: [
        { address: attacker.address, value: '1455639' },
        { address: decoy.address, value: '1000' },
      ],
      receives: [],
    });
  });

  it('shows external outputs below 1000 sats', () => {
    const outputs = [
      { address: attacker.address, value: '999' },
      { address: decoy.address, value: '999' },
      { address: victim.address, value: '90000', payload: change },
    ];
    expect(
      buildBtcPsbtDisplayTransfers({
        authorization: allAuthorization,
        outputs,
      }).sends,
    ).toEqual([
      { address: attacker.address, value: '999' },
      { address: decoy.address, value: '999' },
    ]);
  });

  it('shows a valued output that has no address and hides empty data outputs', () => {
    expect(
      buildBtcPsbtDisplayTransfers({
        authorization: allAuthorization,
        outputs: [
          // pay-to-pubkey: spendable, but not representable as an address
          { address: '', value: '90000' },
          // OP_RETURN marker
          { address: '', value: '0' },
          { address: decoy.address, value: '1000' },
        ],
      }).sends,
    ).toEqual([
      { address: '', value: '90000' },
      { address: decoy.address, value: '1000' },
    ]);
  });

  it('falls back to every output when nothing else is left to show', () => {
    const outputs = [
      { address: victim.address, value: '99000', payload: change },
      { address: '', value: '0' },
    ];
    expect(
      buildBtcPsbtDisplayTransfers({
        authorization: allAuthorization,
        outputs,
      }).sends,
    ).toEqual([
      { address: victim.address, value: '99000' },
      { address: '', value: '0' },
    ]);
  });

  it('shows a lone output as is', () => {
    expect(
      buildBtcPsbtDisplayTransfers({
        authorization: allAuthorization,
        outputs: [{ address: victim.address, value: '99000' }],
      }),
    ).toEqual({
      sends: [{ address: victim.address, value: '99000' }],
      receives: [],
    });
  });

  it('shows only what a SIGHASH_SINGLE signature gives up and gets back', () => {
    expect(
      buildBtcPsbtDisplayTransfers({
        authorization: {
          family: EBtcPsbtSighashFamily.Single,
          hasAnyoneCanPay: true,
          signedInputs: [
            {
              index: 0,
              value: '546',
              address: victim.address,
              committedOutput: {
                index: 0,
                address: victim.address,
                value: '1000000',
              },
            },
          ],
        },
        // Outputs the signature does not commit to are not counted either way.
        outputs: [
          { address: victim.address, value: '1000000' },
          { address: attacker.address, value: '5000' },
          { address: victim.address, value: '700000', payload: change },
        ],
      }),
    ).toEqual({
      sends: [{ address: '', value: '546' }],
      receives: [{ address: victim.address, value: '1000000' }],
    });
  });
});
