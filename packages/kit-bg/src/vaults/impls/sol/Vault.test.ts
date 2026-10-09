import {
  ComputeBudgetProgram,
  PublicKey,
  SystemProgram,
  Transaction,
} from '@solana/web3.js';
import bs58 from 'bs58';

import type { IFeeInfoUnit } from '@onekeyhq/shared/types/fee';

// Importing the vault pulls in the localDb singleton, whose constructor opens
// IndexedDB at module load and crashes under jest's node environment.
jest.mock('../../../dbs/local/localDbInstance', () => ({
  __esModule: true,
  default: {},
}));

// eslint-disable-next-line import/first
import SolVault from './Vault';

// eslint-disable-next-line import/first
import type ClientSol from './sdkSol/ClientSol';

// The dApp fee paths under test never reach backgroundApi, so a bare prototype
// instance with a stubbed client is enough.
const buildVault = () => {
  const vault = Object.create(SolVault.prototype) as SolVault;
  vault.networkId = 'sol--101';
  vault.getClient = async () => ({}) as unknown as ClientSol;
  return vault;
};

const payer = new PublicKey(Buffer.alloc(32, 1));
const receiver = new PublicKey(Buffer.alloc(32, 2));

const buildDappEncodedTx = ({
  computeUnitPrice,
  computeUnitLimit,
  transferCount = 1,
}: {
  computeUnitPrice?: number;
  computeUnitLimit?: number;
  transferCount?: number;
}) => {
  const tx = new Transaction({
    feePayer: payer,
    recentBlockhash: bs58.encode(Buffer.alloc(32, 3)),
  });
  if (computeUnitPrice !== undefined) {
    tx.add(
      ComputeBudgetProgram.setComputeUnitPrice({
        microLamports: computeUnitPrice,
      }),
    );
  }
  if (computeUnitLimit !== undefined) {
    tx.add(
      ComputeBudgetProgram.setComputeUnitLimit({ units: computeUnitLimit }),
    );
  }
  for (let i = 0; i < transferCount; i += 1) {
    tx.add(
      SystemProgram.transfer({
        fromPubkey: payer,
        toPubkey: receiver,
        lamports: i + 1,
      }),
    );
  }
  return bs58.encode(
    tx.serialize({ requireAllSignatures: false, verifySignatures: false }),
  );
};

const feeInfo: IFeeInfoUnit = {
  common: {
    feeDecimals: 9,
    feeSymbol: 'SOL',
    nativeDecimals: 9,
    nativeSymbol: 'SOL',
  },
  feeSol: { computeUnitPrice: '999999' },
};

describe('SolVault dApp transaction fee handling (OK-64196)', () => {
  describe('attachFeeInfoToDAppEncodedTx', () => {
    it.each([
      ['no ComputeBudget instruction', undefined],
      ['a low dApp priority fee', 1],
      ['a high dApp priority fee', 500_000],
    ])(
      'returns "" so the dApp tx is kept byte-identical when it has %s',
      async (_label, computeUnitPrice) => {
        const vault = buildVault();
        const encodedTx = buildDappEncodedTx({ computeUnitPrice });

        await expect(
          vault.attachFeeInfoToDAppEncodedTx({ encodedTx, feeInfo }),
        ).resolves.toBe('');
      },
    );
  });

  describe('updateUnsignedTx', () => {
    it('does not rewrite the encoded tx when the fee is not editable', async () => {
      const vault = buildVault();
      const encodedTx = buildDappEncodedTx({ computeUnitPrice: 123 });

      const result = await vault.updateUnsignedTx({
        unsignedTx: { encodedTx },
        feeInfo,
        feeInfoEditable: false,
      });

      expect(result.encodedTx).toBe(encodedTx);
    });
  });

  describe('buildEstimateFeeParams', () => {
    it('exposes the priority fee carried by the tx for read-only display', async () => {
      const vault = buildVault();
      const encodedTx = buildDappEncodedTx({ computeUnitPrice: 123 });

      const { estimateFeeParams } = await vault.buildEstimateFeeParams({
        encodedTx,
      });

      expect(estimateFeeParams?.estimateFeeParamsSol).toMatchObject({
        computeUnitPriceInTx: '123',
        computeUnitLimit: '200000',
      });
    });

    it('derives the default compute unit limit from the instruction count', async () => {
      const vault = buildVault();
      const encodedTx = buildDappEncodedTx({
        computeUnitPrice: 123,
        transferCount: 3,
      });

      const { estimateFeeParams } = await vault.buildEstimateFeeParams({
        encodedTx,
      });

      // 3 non-ComputeBudget instructions x 200k CU; the price ix is not counted
      expect(estimateFeeParams?.estimateFeeParamsSol).toMatchObject({
        computeUnitLimit: '600000',
        computeUnitPriceInTx: '123',
      });
    });

    it('caps the derived default compute unit limit at 1.4M', async () => {
      const vault = buildVault();
      const encodedTx = buildDappEncodedTx({ transferCount: 8 });

      const { estimateFeeParams } = await vault.buildEstimateFeeParams({
        encodedTx,
      });

      expect(estimateFeeParams?.estimateFeeParamsSol?.computeUnitLimit).toBe(
        '1400000',
      );
    });

    it('uses the explicit SetComputeUnitLimit when the tx carries one', async () => {
      const vault = buildVault();
      const encodedTx = buildDappEncodedTx({
        computeUnitPrice: 123,
        computeUnitLimit: 300_000,
        transferCount: 3,
      });

      const { estimateFeeParams } = await vault.buildEstimateFeeParams({
        encodedTx,
      });

      expect(estimateFeeParams?.estimateFeeParamsSol?.computeUnitLimit).toBe(
        '300000',
      );
    });

    it('reports "0" when the tx carries no SetComputeUnitPrice instruction', async () => {
      const vault = buildVault();
      const encodedTx = buildDappEncodedTx({});

      const { estimateFeeParams } = await vault.buildEstimateFeeParams({
        encodedTx,
      });

      expect(
        estimateFeeParams?.estimateFeeParamsSol?.computeUnitPriceInTx,
      ).toBe('0');
    });
  });
});
