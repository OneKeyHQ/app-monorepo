/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { getTxSpecialInfo } from '.';

import { fireEvent, render } from '@testing-library/react';
import { Buffer as BrowserBuffer } from 'buffer/';

import type { IUnsignedTxPro } from '@onekeyhq/core/src/types';
import type { IEncodedTxZcash } from '@onekeyhq/kit-bg/src/vaults/impls/zcash/types';
import { IMPL_ZCASH } from '@onekeyhq/shared/src/engine/engineConsts';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { encodeZcashMemo } from '@onekeyhq/shared/src/utils/zcashMemo';

const mockDialog = jest.fn<void, [{ renderContent: ReactNode }]>();
const originalBuffer = globalThis.Buffer;

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('@onekeyhq/components', () => {
  const container = ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  );
  const button = ({
    children,
    onPress,
    testID,
  }: {
    children?: ReactNode;
    onPress?: () => void;
    testID?: string;
  }) => (
    <button type="button" data-testid={testID} onClick={onPress}>
      {children}
    </button>
  );
  return {
    Stack: container,
    XStack: container,
    YStack: container,
    ScrollView: container,
    SizableText: container,
    Button: button,
    IconButton: button,
    Dialog: {
      show: (props: { renderContent: ReactNode }) => mockDialog(props),
    },
    useClipboard: () => ({ copyText: jest.fn() }),
  };
});
jest.mock('./TronSpecialInfo', () => ({ TronSpecialInfo: () => null }));

function review(memoHex?: string) {
  const SpecialInfo = getTxSpecialInfo({ impl: IMPL_ZCASH });
  expect(SpecialInfo).toBeDefined();
  if (!SpecialInfo)
    throw new OneKeyLocalError('Zcash review information is missing');
  const encodedTx: IEncodedTxZcash = {
    inputs: [],
    outputs: [{ address: 'u1-synthetic-recipient', value: '10000' }],
    inputsForCoinSelect: [],
    outputsForCoinSelect: [],
    fee: '10000',
    txSize: undefined,
    zcashMode: 'privacy',
    zcashTo: 'u1-synthetic-recipient',
    zcashAmountValue: '10000',
    zcashMemoHex: memoHex,
  };
  const unsignedTxs: IUnsignedTxPro[] = [{ encodedTx }];
  return render(
    <SpecialInfo
      accountId="synthetic-account"
      networkId="zec--0"
      unsignedTxs={unsignedTxs}
    />,
  );
}

beforeEach(() => mockDialog.mockClear());
// Match the browser realm: Node's Buffer inherits a different Uint8Array in JSDOM.
beforeAll(() => {
  globalThis.Buffer = BrowserBuffer as unknown as typeof Buffer;
});
afterAll(() => {
  globalThis.Buffer = originalBuffer;
});

it('shows the exact Unicode memo carried by the transaction on the confirmation page', () => {
  const text = '  invoice 中文\n🙂 ';
  const result = review(encodeZcashMemo(text, 'utf8'));
  expect(result.getByText(text, { normalizer: (value) => value })).toBeTruthy();
});

it('lets the user inspect the full binary memo and its hash before signing', () => {
  const hex = `ff000102${'00'.repeat(508)}`;
  const result = review(hex);
  fireEvent.click(result.getByTestId('zcash-memo-raw-data'));
  expect(mockDialog).toHaveBeenCalledTimes(1);
  const raw = render(<>{mockDialog.mock.calls[0][0].renderContent}</>);
  expect(raw.getByText(hex)).toBeTruthy();
  expect(
    raw.getByText(
      '372a583679ed9562946f4b0a3e9da8b267259960d2531492000cbff7f2ed626b',
    ),
  ).toBeTruthy();
});

it('omits memo UI when the transaction has no memo', () => {
  const result = review();
  expect(result.queryByTestId('zcash-memo-raw-data')).toBeNull();
  expect(result.queryByText(ETranslations.raw_data__title)).toBeNull();
});
