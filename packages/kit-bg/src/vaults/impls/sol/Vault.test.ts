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
}: {
  computeUnitPrice?: number;
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
  tx.add(
    SystemProgram.transfer({
      fromPubkey: payer,
      toPubkey: receiver,
      lamports: 1,
    }),
  );
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
