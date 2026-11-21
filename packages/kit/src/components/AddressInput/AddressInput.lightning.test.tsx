/** @jest-environment jsdom */

import { AddressInput } from '.';

import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';

const LNURL =
  'lnurl1dp68gurn8ghj7um9wfmxjcm99e3k7mf0v9cxj0m385ekvcenxc6r2c35xvukxefcv5mkvv34x5ekzd3ev56nyd3hxqurzepexejxxepnxscrvwfnv9nxzcn9xq6xyefhvgcxxcmyxymnserxfq5fns';
const mockQuery = jest.fn<Promise<{ input: string }>, [{ address: string }]>();

jest.mock('react-native', () => ({
  useWindowDimensions: () => ({ width: 1280 }),
}));
jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('@onekeyhq/components', () => ({
  useFormContext: () => ({ watch: () => undefined }),
}));
jest.mock('@onekeyhq/kit/src/hooks/useRouteIsFocused', () => ({
  useRouteIsFocused: () => true,
}));
jest.mock('../AddressBadge', () => ({ AddressBadge: jest.fn() }));
jest.mock('../WalletAvatar', () => ({ WalletAvatarById: jest.fn() }));
jest.mock('../BaseInput', () => ({
  BaseInput: ({ onChangeText }: { onChangeText: (text: string) => void }) => (
    <textarea
      aria-label="Recipient"
      onChange={(event) => onChangeText(event.currentTarget.value)}
    />
  ),
}));
jest.mock('./plugins/clipboard', () => ({ ClipboardPlugin: jest.fn() }));
jest.mock('./plugins/scan', () => ({ ScanPlugin: jest.fn() }));
jest.mock('./plugins/selector', () => ({ SelectorPlugin: jest.fn() }));
jest.mock('./AddressInputHyperlinkText', () => ({
  renderAddressInputHyperlinkText: jest.fn(),
}));
jest.mock('./AddressInputWarnings', () => ({
  AddressInputWarnings: jest.fn(),
}));
jest.mock('./utils', () => ({
  queryAddressWithFallback: (params: { address: string }) => mockQuery(params),
}));

it.each([
  ['Lightning', getNetworkIdsMap().lightning, '\n'],
  ['other networks', getNetworkIdsMap().btc, ''],
])(
  'preserves payment text boundaries before validation on %s',
  async (_name, networkId, separator) => {
    const onChange = jest.fn();
    const address = `Pay here:${separator}${LNURL}`;
    // Use an unrelated response so this test can focus on the input sent to validation.
    mockQuery.mockResolvedValueOnce({ input: '' });
    render(
      <AddressInput
        name="to"
        accountId="account-id"
        networkId={networkId}
        onChange={onChange}
      />,
    );
    fireEvent.change(screen.getByRole('textbox', { name: 'Recipient' }), {
      target: { value: `Pay here:\n${LNURL}` },
    });

    expect(onChange).toHaveBeenCalledWith({ raw: address, pending: true });
    await waitFor(() =>
      expect(mockQuery).toHaveBeenCalledWith(
        expect.objectContaining({ address, networkId }),
      ),
    );
    mockQuery.mockClear();
  },
);

it.each([
  [
    'lnurlp://example.com/rece\nive?mode=once',
    'lnurlp://example.com/receive?mode=once',
  ],
  [
    'lightning:lnurlp://example.com/receive?ref=abc\ndef',
    'lightning:lnurlp://example.com/receive?ref=abcdef',
  ],
])(
  'sends a wrapped standalone Lightning URI to validation in full',
  async (text, address) => {
    mockQuery.mockClear();
    mockQuery.mockResolvedValueOnce({ input: '' });
    const networkId = getNetworkIdsMap().lightning;
    const onChange = jest.fn();
    render(
      <AddressInput
        name="to"
        accountId="account-id"
        networkId={networkId}
        onChange={onChange}
      />,
    );
    fireEvent.change(screen.getByRole('textbox', { name: 'Recipient' }), {
      target: { value: text },
    });

    expect(onChange).toHaveBeenCalledWith({ raw: address, pending: true });
    await waitFor(() => {
      expect(mockQuery).toHaveBeenCalledWith(
        expect.objectContaining({ address, networkId }),
      );
    });
  },
);
