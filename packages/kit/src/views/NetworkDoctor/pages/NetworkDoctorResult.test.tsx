/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { render } from '@testing-library/react';

import type { INetworkDoctorState } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { INetworkCheckup } from '@onekeyhq/shared/src/modules/NetworkDoctor/types';
import {
  ENetworkConnectivityLevel,
  EOneKeyFailureReason,
} from '@onekeyhq/shared/src/modules/NetworkDoctor/types';

import NetworkDoctorResult from './NetworkDoctorResult';

const healthySummary: INetworkCheckup['summary'] = {
  allCriticalChecksPassed: true,
  assessment: 'healthy',
  conclusion: {
    connectivityLevel: ENetworkConnectivityLevel.HEALTHY,
    oneKeyFailureReason: EOneKeyFailureReason.NONE,
    failureLayer: null,
    summary: 'healthy',
    suggestedActions: [],
    assessment: 'healthy',
  },
};
const completedState: INetworkDoctorState = {
  status: 'completed',
  progress: null,
  // The page only reads the summary.
  result: { summary: healthySummary } as INetworkCheckup,
  error: null,
};
const runningState: INetworkDoctorState = {
  status: 'running',
  progress: null,
  result: null,
  error: null,
};
const failedState: INetworkDoctorState = {
  status: 'failed',
  progress: null,
  result: null,
  error: 'Network unreachable',
};

let mockDoctorState = completedState;
const mockResetNetworkDiagnostics = jest.fn<Promise<void>, []>();

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));

jest.mock('@onekeyhq/components', () => {
  const Passthrough = ({ children }: { children?: ReactNode }) => children;
  const Empty = () => null;
  return {
    Button: Passthrough,
    Empty,
    Heading: Passthrough,
    Icon: Empty,
    Page: Object.assign(({ children }: { children?: ReactNode }) => children, {
      Header: Empty,
      Body: Passthrough,
      Footer: Passthrough,
      FooterActions: Empty,
    }),
    SizableText: Passthrough,
    YStack: Passthrough,
  };
});

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  useNetworkDoctorStateAtom: () => [mockDoctorState],
}));

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceNetworkDoctor: {
      resetNetworkDiagnostics: () => mockResetNetworkDiagnostics(),
    },
  },
}));

jest.mock('@onekeyhq/kit/src/hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => ({ pop: jest.fn() }),
}));

jest.mock('@onekeyhq/shared/src/locale', () => ({
  ETranslations: new Proxy({}, { get: (_target, key) => key }),
}));

jest.mock('@onekeyhq/shared/src/modules3rdParty/intercom', () => ({
  showIntercom: jest.fn(),
}));

describe('NetworkDoctorResult', () => {
  beforeEach(() => {
    mockResetNetworkDiagnostics.mockClear();
    mockDoctorState = completedState;
  });

  it('keeps a new run that replaces an old result while the page is open', () => {
    const view = render(<NetworkDoctorResult />);

    mockDoctorState = runningState;
    view.rerender(<NetworkDoctorResult />);
    expect(mockResetNetworkDiagnostics).not.toHaveBeenCalled();

    view.unmount();
    expect(mockResetNetworkDiagnostics).not.toHaveBeenCalled();
  });

  it.each([completedState, failedState])(
    'resets a $status check when the page closes',
    (state) => {
      mockDoctorState = state;
      const view = render(<NetworkDoctorResult />);

      view.unmount();

      expect(mockResetNetworkDiagnostics).toHaveBeenCalledTimes(1);
    },
  );

  it('resets a run that finishes while the page is open when it closes', () => {
    mockDoctorState = runningState;
    const view = render(<NetworkDoctorResult />);

    mockDoctorState = completedState;
    view.rerender(<NetworkDoctorResult />);
    expect(mockResetNetworkDiagnostics).not.toHaveBeenCalled();

    view.unmount();
    expect(mockResetNetworkDiagnostics).toHaveBeenCalledTimes(1);
  });
});
