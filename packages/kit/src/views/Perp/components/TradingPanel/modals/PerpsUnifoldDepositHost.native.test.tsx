/** @jest-environment jsdom */
// cspell: words unifold Unifold

import type { ReactNode } from 'react';

import { render } from '@testing-library/react';

import { PerpsUnifoldDepositHost } from './PerpsUnifoldDepositHost.native';

const mockBeginDeposit = jest.fn();
const mockPortalBody = jest.fn(
  ({ children }: { children: ReactNode }) => children,
);
const mockUnifoldProvider = jest.fn(
  ({ children }: { children: ReactNode }) => children,
);
const mockSetNativeUnifoldBeginDeposit = jest.fn();

jest.mock('@unifold/connect-react-native', () => ({
  UnifoldProvider: (props: { children: ReactNode }) =>
    mockUnifoldProvider(props),
  useUnifold: () => ({ beginDeposit: mockBeginDeposit }),
}));

jest.mock('@onekeyhq/components', () => ({
  Portal: {
    Body: (props: { children: ReactNode; container: string }) =>
      mockPortalBody(props),
    Constant: {
      FULL_WINDOW_OVERLAY_PORTAL: 'full-window-overlay',
    },
  },
  useThemeName: () => 'light',
}));

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    isNativeAndroid: false,
  },
}));

jest.mock('../../../consts/unifold', () => ({
  UNIFOLD_PERPS_PUBLISHABLE_KEY: 'pk_test_unifold',
}));

jest.mock('./unifoldNativeBridge', () => ({
  getNativeUnifoldBeginDeposit: jest.fn(),
  setNativeUnifoldBeginDeposit: (beginDeposit: unknown) => {
    mockSetNativeUnifoldBeginDeposit(beginDeposit);
  },
}));

describe('PerpsUnifoldDepositHost', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the provider in the full-window overlay portal', () => {
    render(<PerpsUnifoldDepositHost />);

    expect(mockPortalBody).toHaveBeenCalledWith(
      expect.objectContaining({
        container: 'full-window-overlay',
      }),
    );
    expect(mockUnifoldProvider).toHaveBeenCalledTimes(1);
    expect(mockSetNativeUnifoldBeginDeposit).toHaveBeenCalledWith(
      mockBeginDeposit,
    );
  });
});
