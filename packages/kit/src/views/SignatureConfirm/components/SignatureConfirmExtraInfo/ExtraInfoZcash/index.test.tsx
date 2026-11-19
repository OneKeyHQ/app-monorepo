/** @jest-environment jsdom */
import type { ReactNode } from 'react';

import TxExtraInfoZcash from '.';

import { render, screen } from '@testing-library/react';

import type { IEncodedTxZcash } from '@onekeyhq/kit-bg/src/vaults/impls/zcash/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EParseTxComponentType } from '@onekeyhq/shared/types/signatureConfirm';
import type { IDecodedTx } from '@onekeyhq/shared/types/tx';

let mockDecodedTx: Pick<
  IDecodedTx,
  'signer' | 'encodedTx' | 'isLocalParsed' | 'txDisplay'
>;

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('@onekeyhq/kit/src/states/jotai/contexts/signatureConfirm', () => ({
  useDecodedTxsAtom: () => [{ decodedTxs: [mockDecodedTx] }],
}));
jest.mock('@onekeyhq/kit/src/components/ZcashMemo', () => ({
  ZcashMemo: ({ text }: { text: string }) => <div>{text}</div>,
}));
jest.mock('@onekeyhq/shared/src/utils/zcashMemo', () => ({
  getZcashMemoDisplay: (hex: string) => ({
    hex,
    hash: 'test-memo-hash',
    text: 'test memo',
  }),
}));
jest.mock('../../SignatureConfirmItem', () => {
  const Item = ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  );
  return {
    SignatureConfirmItem: Object.assign(Item, { Label: Item, Value: Item }),
  };
});

const inputAddress = 't1UYsZVJkLPeMjxEtACvSxfWuNmddpWfxzs';
const otherAddress = 't1gzpngZcWuDFHqVKdStPJTN1WFLQyQ6grR';

beforeEach(() => {
  const tx: IEncodedTxZcash = {
    inputs: [
      {
        txid: 'aa'.repeat(32),
        vout: 0,
        value: '5000',
        address: inputAddress,
        path: '',
      },
    ],
    outputs: [{ address: otherAddress, value: '1000' }],
    inputsForCoinSelect: [],
    outputsForCoinSelect: [],
    fee: '10000',
    txSize: undefined,
    zcashMode: 'transparent',
    zcashTo: otherAddress,
    zcashAmountValue: '1000',
    zcashMemoHex: '74657374206d656d6f'.padEnd(1024, '0'),
  };
  mockDecodedTx = {
    signer: inputAddress,
    encodedTx: tx,
    isLocalParsed: true,
    txDisplay: {
      title: 'Send',
      alerts: [],
      components: [
        {
          type: EParseTxComponentType.Address,
          address: inputAddress,
          label: 'Account',
          tags: [],
        },
      ],
    },
  };
});

it.each([
  ['a locally parsed send', () => undefined],
  [
    'a send that was not locally parsed',
    () => {
      mockDecodedTx.isLocalParsed = false;
    },
  ],
  [
    'a send whose first address is not the signer',
    () => {
      mockDecodedTx.signer = otherAddress;
    },
  ],
])('never lists transparent input addresses for %s', (_label, arrange) => {
  arrange();
  render(<TxExtraInfoZcash />);
  expect(screen.queryByText(inputAddress)).toBeNull();
  expect(screen.getByText('test memo')).toBeTruthy();
});

it('adds no source pool row for a shielded spend', () => {
  const tx: IEncodedTxZcash = {
    ...(mockDecodedTx.encodedTx as IEncodedTxZcash),
    zcashMode: 'privacy',
    zcashSpendSource: 'ironwood',
  };
  mockDecodedTx.encodedTx = tx;
  render(<TxExtraInfoZcash />);
  expect(screen.queryByText('Ironwood')).toBeNull();
  expect(screen.queryByText(ETranslations.global_from)).toBeNull();
  expect(screen.getByText('test memo')).toBeTruthy();
});
