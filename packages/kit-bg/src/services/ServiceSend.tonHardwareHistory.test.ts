import { EAlphTxType } from '@onekeyhq/core/src/chains/alph/types';
import type { IEncodedTxAlph } from '@onekeyhq/core/src/chains/alph/types';
import type { IEncodedTxTon } from '@onekeyhq/core/src/chains/ton/types';
import type { ISignedTxPro, IUnsignedTxPro } from '@onekeyhq/core/src/types';
import type { IDecodedTx } from '@onekeyhq/shared/types/tx';

import { vaultFactory } from '../vaults/factory';

import ServiceSend from './ServiceSend';

jest.mock('p-limit', () => ({
  __esModule: true,
  default: () => (fn: () => unknown) => fn(),
}));
jest.mock('p-retry', () => ({
  __esModule: true,
  default: (fn: () => unknown) => fn(),
}));
jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => ({
  backgroundClass: () => () => undefined,
  backgroundMethod:
    () => (_t: unknown, _k: unknown, descriptor: PropertyDescriptor) =>
      descriptor,
  toastIfError:
    () => (_t: unknown, _k: unknown, descriptor: PropertyDescriptor) =>
      descriptor,
}));
jest.mock('./ServiceBase', () => ({
  __esModule: true,
  default: class ServiceBase {},
}));
jest.mock('../vaults/factory', () => ({
  vaultFactory: { getVault: jest.fn() },
}));
jest.mock('@onekeyhq/shared/src/locale/appLocale', () => ({
  appLocale: {
    intl: { formatMessage: ({ id }: { id: string }) => id },
    onLocaleChange: () => undefined,
  },
}));

afterEach(() => jest.restoreAllMocks());

describe('TON and ALPH hardware history use the actual signed transaction', () => {
  it.each([
    {
      networkId: 'ton--mainnet',
      accountId: "hw-test--m/44'/607'/0'--v4R2",
      useSigned: true,
    },
    {
      networkId: 'ton--mainnet',
      accountId: "hd-1--m/44'/607'/0'--v4R2",
      useSigned: false,
    },
    {
      networkId: 'evm--1',
      accountId: "hw-test--m/44'/60'/0'/0/0",
      useSigned: false,
    },
    {
      networkId: 'alph--mainnet',
      accountId: "hw-test--m/44'/1234'/0'",
      useSigned: true,
    },
    {
      networkId: 'alph--mainnet',
      accountId: "hd-1--m/44'/1234'/0'",
      useSigned: false,
    },
  ])(
    'selects the correct history source for $networkId / $accountId',
    async ({ networkId, accountId, useSigned }) => {
      const requestedTon: IEncodedTxTon = {
        from: `0:${'11'.repeat(32)}`,
        messages: [
          {
            address: `0:${'22'.repeat(32)}`,
            amount: '1',
            payload: 'request-layout',
          },
        ],
      };
      const signedTon: IEncodedTxTon = {
        ...requestedTon,
        sequenceNo: 7,
        messages: [{ ...requestedTon.messages[0], payload: 'device-layout' }],
      };
      const requestedAlph = {
        type: EAlphTxType.Transfer,
        params: {
          signerAddress: 'test-sender',
          destinations: [{ address: 'test-recipient', attoAlphAmount: '1000' }],
          gasAmount: 70_000,
          gasPrice: '100000000000',
        },
      } satisfies IEncodedTxAlph;
      const signedAlph: IEncodedTxAlph = {
        ...requestedAlph,
        params: {
          ...requestedAlph.params,
          utxos: [{ hint: 1, key: '11'.repeat(32) }],
        },
      };
      const requested =
        networkId === 'alph--mainnet' ? requestedAlph : requestedTon;
      const signed = networkId === 'alph--mainnet' ? signedAlph : signedTon;
      const unsignedTx: IUnsignedTxPro = {
        encodedTx: requested,
        uuid: 'transaction-context',
      };
      const signedTx: ISignedTxPro = {
        encodedTx: signed,
        txid: 'transaction-id',
        rawTx: 'signed-transaction',
      };
      const addSignature = jest.fn();
      const saveHistory = jest.fn();
      const service = Object.assign(Object.create(ServiceSend.prototype), {
        backgroundApi: {
          serviceSignature: { addItemFromSendProcess: addSignature },
          serviceHistory: { saveSendConfirmHistoryTxs: saveHistory },
        },
      }) as ServiceSend;
      jest
        .mocked(vaultFactory.getVault)
        .mockResolvedValue(
          {} as Awaited<ReturnType<typeof vaultFactory.getVault>>,
        );
      jest.spyOn(service, 'signAndSendTransaction').mockResolvedValue(signedTx);
      const decodedTx = { actions: [] } as unknown as IDecodedTx;
      const decode = jest
        .spyOn(service, 'buildDecodedTx')
        .mockResolvedValue(decodedTx);

      await service.batchSignAndSendTransaction({
        networkId,
        accountId,
        unsignedTxs: [unsignedTx],
        signOnly: false,
        transferPayload: undefined,
      });

      expect(decode).toHaveBeenCalledWith(
        expect.objectContaining({
          unsignedTx: {
            ...unsignedTx,
            encodedTx: useSigned ? signed : requested,
          },
          saveToLocalHistory: true,
        }),
      );
      expect(saveHistory).toHaveBeenCalledWith(
        expect.objectContaining({ data: { signedTx, decodedTx } }),
      );
      expect(addSignature).toHaveBeenCalledTimes(1);
      expect(unsignedTx.encodedTx).toBe(requested);
    },
  );
});
