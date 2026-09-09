/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { render, screen } from '@testing-library/react';

import type { IUnsignedTxPro } from '@onekeyhq/core/src/types';

import TxConfirmHeaderRight from './TxConfirmHeaderRight';

jest.mock('@onekeyhq/components', () => ({
  Button: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  HeaderButtonGroup: ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  ),
  Image: (props: {
    width?: unknown;
    height?: unknown;
    resizeMode?: string;
    source?: { uri?: string };
  }) => (
    <div
      data-testid="mev-provider-logo"
      data-width={String(props.width)}
      data-height={String(props.height)}
      data-resize-mode={props.resizeMode}
      data-uri={props.source?.uri}
    />
  ),
  Popover: ({ renderContent }: { renderContent: ReactNode }) => (
    <div>{renderContent}</div>
  ),
  SizableText: ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  ),
  YStack: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  useMedia: () => ({ gtMd: true }),
  useThemeName: () => 'light',
}));

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));

function buildSwapUnsignedTx(networkId: string): IUnsignedTxPro {
  return {
    encodedTx: {},
    swapInfo: {
      sender: { accountInfo: { networkId } },
      receiver: { accountInfo: { networkId } },
      swapBuildResData: { result: {} },
    },
  } as unknown as IUnsignedTxPro;
}

describe('TxConfirmHeaderRight MEV provider logo (OK-62097)', () => {
  it('renders the provider logo at full width and fixed height before the image has loaded', () => {
    render(
      <TxConfirmHeaderRight
        decodedTxs={[]}
        unsignedTxs={[buildSwapUnsignedTx('evm--56')]}
        effectiveFeePayer="user"
        txFeeInfoInit
      />,
    );

    const logo = screen.getByTestId('mev-provider-logo');
    expect(logo.getAttribute('data-uri')).toBe(
      'https://uni.onekey-asset.com/static/logo/blink.png',
    );
    expect(logo.getAttribute('data-width')).toBe('100%');
    expect(logo.getAttribute('data-height')).toBe('40');
    expect(logo.getAttribute('data-resize-mode')).toBe('contain');
  });
});
