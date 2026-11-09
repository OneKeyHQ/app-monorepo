/*
yarn jest packages/kit-bg/src/vaults/impls/alph/Vault.test.ts

OK-64709: the Alephium node's `/transactions/build` reserves one dust amount
(0.001 ALPH) for the sender's change output, so an account can never spend its
whole balance through that endpoint. The vault has to surface that reserve as a
frozen balance, so Max and the confirm page already exclude it, instead of
silently subtracting it from the amount the UI displayed.
*/
import { DUST_AMOUNT } from '@alephium/web3';
import BigNumber from 'bignumber.js';

import { EAlphTxType } from '@onekeyhq/core/src/chains/alph/types';
import type { IEncodedTxAlph } from '@onekeyhq/core/src/chains/alph/types';
import type { IUnsignedTxPro } from '@onekeyhq/core/src/types';
import type { IFetchAccountDetailsResp } from '@onekeyhq/shared/types/address';
import type {
  IFetchTokenDetailItem,
  IToken,
} from '@onekeyhq/shared/types/token';

// Importing the vault pulls in the localDb singleton, whose constructor opens
// IndexedDB at module load and crashes under jest's node environment.
jest.mock('../../../dbs/local/localDbInstance', () => ({
  __esModule: true,
  default: {},
}));

// eslint-disable-next-line import/first
import { MAX_GAS_AMOUNT } from './sdkAlph/utils';
// eslint-disable-next-line import/first
import AlphVault from './Vault';

// eslint-disable-next-line import/first
import type { SignTransferTxParams } from '@alephium/web3';

const NETWORK = {
  id: 'alph--0',
  decimals: 18,
  symbol: 'ALPH',
  name: 'Alephium',
};
const SENDER = '192bWu4Ce7TxSrEMjmRfaDZUvXPGxrvc6ApDk6RVgXzXk';
const RECIPIENT = '1GfF6iDLELKXUGPEZTeSqU2KD2EuZa42eiX9gTrhrRvs9';
// 0.001 ALPH in attoALPH
const DUST = DUST_AMOUNT.toString();

const alph = (amount: string) =>
  new BigNumber(amount).shiftedBy(NETWORK.decimals).toFixed();

function createVault({
  onChainBalance = '0',
}: { onChainBalance?: string } = {}) {
  const vault = Object.create(AlphVault.prototype) as AlphVault;
  Object.assign(vault, {
    networkId: NETWORK.id,
    accountId: 'hd-1--m/44h/1234h/0h',
    getNetwork: jest.fn().mockResolvedValue(NETWORK),
    getAccount: jest.fn().mockResolvedValue({
      id: 'hd-1--m/44h/1234h/0h',
      address: SENDER,
      pub: `03${'ab'.repeat(32)}`,
    }),
    backgroundApi: {
      serviceAccountProfile: {
        fetchAccountNativeBalance: jest.fn().mockResolvedValue({
          address: SENDER,
          balance: onChainBalance,
          balanceParsed: new BigNumber(onChainBalance)
            .shiftedBy(-NETWORK.decimals)
            .toFixed(),
        }),
      },
    },
  });
  return vault;
}

function nativeTokenDetail(
  balance: string,
  { price = 0 }: { price?: number } = {},
): IFetchTokenDetailItem {
  const balanceParsed = new BigNumber(balance)
    .shiftedBy(-NETWORK.decimals)
    .toFixed();
  return {
    info: {
      address: '',
      isNative: true,
      decimals: NETWORK.decimals,
      symbol: NETWORK.symbol,
      name: NETWORK.name,
      networkId: NETWORK.id,
    } as IToken,
    balance,
    balanceParsed,
    // the server prices the whole balance
    fiatValue: new BigNumber(balanceParsed).times(price).toFixed(),
    price,
  };
}

function transferTx(attoAlphAmount: string): IEncodedTxAlph {
  return {
    type: EAlphTxType.Transfer,
    params: {
      signerAddress: SENDER,
      signerKeyType: 'default',
      destinations: [{ address: RECIPIENT, attoAlphAmount }],
    },
  };
}

const destinationAmount = (tx: unknown) =>
  (tx as SignTransferTxParams).destinations[0].attoAlphAmount.toString();

describe('AlphVault change-output dust reserve (OK-64709)', () => {
  describe('fillTokensDetails', () => {
    it('moves the 0.001 ALPH change reserve of the native token into frozenBalance', async () => {
      const vault = createVault();
      const other: IFetchTokenDetailItem = {
        info: {
          address: 'vT49PY8ksoUL6NcXiZ1t2wAmC7tTPRfFfER8n3UCLvXy',
          isNative: false,
          decimals: 6,
          symbol: 'TKN',
          name: 'Token',
        } as IToken,
        balance: '5',
        balanceParsed: '0.000005',
        fiatValue: '0',
        price: 0,
      };

      const [native, token] = await vault.fillTokensDetails({
        tokensDetails: [nativeTokenDetail(alph('0.101')), other],
      });

      expect(native).toMatchObject({
        balance: alph('0.1'),
        balanceParsed: '0.1',
        frozenBalance: DUST,
        frozenBalanceParsed: '0.001',
        totalBalance: alph('0.101'),
        totalBalanceParsed: '0.101',
      });
      expect(token).toEqual(other);
    });

    it('never freezes more than the account holds', async () => {
      const vault = createVault();

      const [native] = await vault.fillTokensDetails({
        tokensDetails: [nativeTokenDetail(alph('0.0004'))],
      });

      expect(native).toMatchObject({
        balance: '0',
        balanceParsed: '0',
        frozenBalance: alph('0.0004'),
        frozenBalanceParsed: '0.0004',
        totalBalance: alph('0.0004'),
        totalBalanceParsed: '0.0004',
      });
    });

    it('prices the spendable balance so fiat Max converts back to the spendable amount', async () => {
      const vault = createVault();
      const price = 0.3;

      const [native] = await vault.fillTokensDetails({
        tokensDetails: [nativeTokenDetail(alph('0.101'), { price })],
      });

      expect(native).toMatchObject({
        balanceParsed: '0.1',
        fiatValue: '0.03',
        frozenBalanceFiatValue: '0.0003',
        totalBalanceFiatValue: '0.0303',
        price,
      });
      // what the amount page does with fiat Max: fiat / price must not exceed
      // the spendable balance, otherwise the send is blocked as insufficient
      expect(
        new BigNumber(native.fiatValue)
          .div(native.price)
          .isGreaterThan(native.balanceParsed),
      ).toBe(false);
    });

    it('pro-rates the server fiat value when the price is unusable', async () => {
      const vault = createVault();
      const token = nativeTokenDetail(alph('0.101'));
      // the API reports "--" for an unknown price
      token.price = '--' as unknown as number;
      token.fiatValue = '0.0303';

      const [native] = await vault.fillTokensDetails({
        tokensDetails: [token],
      });

      expect(native).toMatchObject({
        balanceParsed: '0.1',
        fiatValue: '0.03',
        frozenBalanceFiatValue: '0.0003',
        totalBalanceFiatValue: '0.0303',
      });
    });

    it('leaves the fiat fields alone when the server sends none', async () => {
      const vault = createVault();
      const token = nativeTokenDetail(alph('0.101'));
      token.fiatValue = undefined as unknown as string;

      const [native] = await vault.fillTokensDetails({
        tokensDetails: [token],
      });

      expect(native.balanceParsed).toBe('0.1');
      expect(native.fiatValue).toBeUndefined();
      expect(native.frozenBalanceFiatValue).toBeUndefined();
      expect(native.totalBalanceFiatValue).toBeUndefined();
    });
  });

  describe('fillTokensDetailsBatch', () => {
    it('applies the change reserve to every sender of a bulk-send batch', async () => {
      const vault = createVault();
      const other: IFetchTokenDetailItem = {
        info: {
          address: 'vT49PY8ksoUL6NcXiZ1t2wAmC7tTPRfFfER8n3UCLvXy',
          isNative: false,
          decimals: 6,
          symbol: 'TKN',
          name: 'Token',
        } as IToken,
        balance: '5',
        balanceParsed: '0.000005',
        fiatValue: '0',
        price: 0,
      };

      const [first, second] = await vault.fillTokensDetailsBatch({
        tokensDetailsBatch: [
          {
            accountAddress: SENDER,
            tokens: [nativeTokenDetail(alph('0.101'))],
          },
          {
            accountAddress: RECIPIENT,
            tokens: [nativeTokenDetail(alph('2.5')), other],
          },
        ],
      });

      expect(first.accountAddress).toBe(SENDER);
      expect(first.tokens[0]).toMatchObject({
        balanceParsed: '0.1',
        frozenBalanceParsed: '0.001',
        totalBalanceParsed: '0.101',
      });
      expect(second.accountAddress).toBe(RECIPIENT);
      expect(second.tokens[0]).toMatchObject({
        balanceParsed: '2.499',
        frozenBalanceParsed: '0.001',
        totalBalanceParsed: '2.5',
      });
      expect(second.tokens[1]).toEqual(other);
    });
  });

  describe('fillAccountDetails', () => {
    it('reports spendable, frozen and total balance', async () => {
      const vault = createVault();
      const accountDetails: IFetchAccountDetailsResp = {
        address: SENDER,
        balance: alph('0.101'),
        balanceParsed: '0.101',
      };

      await expect(
        vault.fillAccountDetails({ accountDetails }),
      ).resolves.toMatchObject({
        balance: alph('0.1'),
        balanceParsed: '0.1',
        frozenBalance: DUST,
        frozenBalanceParsed: '0.001',
        totalBalance: alph('0.101'),
        totalBalanceParsed: '0.101',
      });
    });
  });

  describe('updateUnsignedTx', () => {
    it('sends exactly the spendable max the confirm page displayed', async () => {
      const vault = createVault();
      const unsignedTx = {
        encodedTx: transferTx(alph('0.1')),
        transfersInfo: [],
      } as IUnsignedTxPro;

      // spendable 0.1 ALPH minus the 0.002 ALPH fee, as shown on the confirm page
      const result = await vault.updateUnsignedTx({
        unsignedTx,
        nativeAmountInfo: { maxSendAmount: '0.098' },
      });

      expect(
        destinationAmount((result.encodedTx as IEncodedTxAlph).params),
      ).toBe(alph('0.098'));
    });
  });

  describe('buildEstimateFeeParams', () => {
    it('keeps gas headroom below the spendable balance when estimating a max send', async () => {
      const vault = createVault({ onChainBalance: alph('0.101') });
      // Max on the amount page = on-chain balance minus the dust reserve
      const encodedTx = transferTx(alph('0.1'));

      const { encodedTx: estimateTx } = await vault.buildEstimateFeeParams({
        encodedTx,
      });

      expect(destinationAmount(estimateTx)).toBe(
        new BigNumber(alph('0.1')).minus(MAX_GAS_AMOUNT).toFixed(),
      );
      // the tx that is signed later must not carry the estimate-only amount
      expect(destinationAmount(encodedTx.params)).toBe(alph('0.1'));
    });

    it('keeps gas headroom for a near-max amount below the spendable balance', async () => {
      const vault = createVault({ onChainBalance: alph('0.101') });
      // 0.099 ALPH is below the 0.1 ALPH spendable balance, but the gas
      // allowance no longer fits next to it
      const encodedTx = transferTx(alph('0.099'));

      const { encodedTx: estimateTx } = await vault.buildEstimateFeeParams({
        encodedTx,
      });

      expect(destinationAmount(estimateTx)).toBe(
        new BigNumber(alph('0.1')).minus(MAX_GAS_AMOUNT).toFixed(),
      );
      expect(destinationAmount(encodedTx.params)).toBe(alph('0.099'));
    });

    it('estimates amounts that leave the gas allowance free as they are', async () => {
      const vault = createVault({ onChainBalance: alph('0.101') });

      const { encodedTx: estimateTx } = await vault.buildEstimateFeeParams({
        encodedTx: transferTx(alph('0.05')),
      });

      expect(destinationAmount(estimateTx)).toBe(alph('0.05'));
    });

    it('estimates as entered when the balance cannot fund the gas allowance', async () => {
      // spendable 0.007 ALPH minus the 0.01 ALPH allowance leaves no valid output
      const vault = createVault({ onChainBalance: alph('0.008') });

      const { encodedTx: estimateTx } = await vault.buildEstimateFeeParams({
        encodedTx: transferTx(alph('0.002')),
      });

      expect(destinationAmount(estimateTx)).toBe(alph('0.002'));
    });
  });
});
