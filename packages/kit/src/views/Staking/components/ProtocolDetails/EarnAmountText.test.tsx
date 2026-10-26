/** @jest-environment jsdom */

/* eslint-disable import/first */

import type { ReactNode } from 'react';

jest.mock('react-intl', () => {
  const actual = jest.requireActual<typeof import('react-intl')>('react-intl');
  const createIntl: typeof actual.createIntl = (config, cache) =>
    actual.createIntl({ ...config, locale: config.locale || 'en' }, cache);

  return {
    ...actual,
    createIntl,
    useIntl: () => createIntl({ locale: 'en' }),
  };
});

jest.mock('@onekeyhq/components', () => ({
  // Rich-text handlers return an array of inline text nodes. Assign keys in
  // the DOM test double just like the native text host does.
  SizableText: ({
    children,
    fontSize,
  }: {
    children?: ReactNode;
    fontSize?: number;
  }) => {
    const React = jest.requireActual<typeof import('react')>('react');
    return (
      <span data-font-size={fontSize}>{React.Children.toArray(children)}</span>
    );
  },
  getFontSize: () => 16,
  NumberSizeableText: ({ children }: { children?: ReactNode }) => (
    <span>{children}</span>
  ),
}));

jest.mock(
  '@onekeyhq/kit/src/views/ScanQrCode/hooks/useParseQRCodeLazy',
  () => ({
    __esModule: true,
    default: () => ({ parse: jest.fn() }),
  }),
);

jest.mock('@onekeyhq/shared/src/utils/openUrlUtils', () => ({
  openUrlExternal: jest.fn(),
  openUrlInApp: jest.fn(),
}));

jest.mock('@onekeyhq/shared/src/utils/webViewUrlSafety', () => ({
  isAllowedWebViewUrl: jest.fn(() => true),
}));

jest.mock('@onekeyhq/shared/types/qrCode', () => ({
  EQRCodeHandlerNames: {},
}));

import { render } from '@testing-library/react';

import { EarnAmountText } from './EarnAmountText';

describe('EarnAmountText', () => {
  it('renders server subscript markup as rich text instead of a literal tag', () => {
    const { container } = render(
      <EarnAmountText size="$bodyMd">
        {'0.0<subscripts>5</subscripts>927'}
      </EarnAmountText>,
    );

    expect(container.textContent).toBe('0.05927');
    expect(container.textContent).not.toContain('<subscripts>');
    expect(container.querySelector('[data-font-size="10"]')?.textContent).toBe(
      '5',
    );
  });
});
