/** @jest-environment jsdom */
/* eslint-disable import/first */

const mockToken = jest.fn();
let mockIsNative = true;

jest.mock('@onekeyhq/kit/src/components/Token', () => ({
  TOKEN_SIZE_MAP: {
    lg: {
      tokenImageSize: '$10',
      fallbackIconSize: '$7',
      tokenImageResizeWidth: 40,
    },
    md: {
      tokenImageSize: '$8',
      fallbackIconSize: '$6',
      tokenImageResizeWidth: 32,
    },
  },
  getTokenImageResizeWidth: (size: 'lg' | 'md') => (size === 'lg' ? 40 : 32),
  Token: (props: Record<string, unknown>) => {
    mockToken(props);
    return null;
  },
}));

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    get isNative() {
      return mockIsNative;
    },
  },
}));

import { isValidElement } from 'react';

import { render } from '@testing-library/react';

import { BorrowAssetToken } from './BorrowAssetToken';

describe('BorrowAssetToken loading visual', () => {
  beforeEach(() => {
    mockToken.mockClear();
    mockIsNative = true;
  });

  it('shows a visible static loading glyph while native resolves the image', () => {
    render(
      <BorrowAssetToken size="lg" logoURI="https://example.com/sol.png" />,
    );

    expect(mockToken).toHaveBeenCalledWith(
      expect.objectContaining({
        size: 'lg',
        tokenImageUri: 'https://example.com/sol.png',
        resizeWidth: 40,
        loadingStrategy: 'static',
      }),
    );
    expect(isValidElement(mockToken.mock.calls[0][0].placeholder)).toBe(true);
  });

  it('keeps the shared web loading visual', () => {
    mockIsNative = false;
    render(
      <BorrowAssetToken size="md" logoURI="https://example.com/sol.png" />,
    );

    expect(mockToken).toHaveBeenCalledWith({
      size: 'md',
      tokenImageUri: 'https://example.com/sol.png',
      resizeWidth: 32,
    });
  });
});
