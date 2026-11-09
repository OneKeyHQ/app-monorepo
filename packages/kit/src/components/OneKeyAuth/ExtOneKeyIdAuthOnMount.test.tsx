/** @jest-environment jsdom */

import { act, cleanup, render } from '@testing-library/react';

import { EExtOneKeyIdAuthFlow } from '@onekeyhq/shared/src/consts/authConsts';
import {
  PrimeLoginDialogCancelError,
  PrimeLoginHandedOffToExtExpandTabError,
} from '@onekeyhq/shared/src/errors';

import { ExtOneKeyIdAuthOnMount } from './ExtOneKeyIdAuthOnMount';

const mockLoginOneKeyId = jest.fn();
const mockRunPendingAction = jest.fn();
const mockClearPendingActionCreatedBefore = jest.fn();
const mockShowLegacyBind = jest.fn();
let mockFlowInfo: { flow: EExtOneKeyIdAuthFlow } | undefined;

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isExtensionUiExpandTab: true },
}));

jest.mock('./extOneKeyIdAuthExpandTab', () => ({
  consumeExtOneKeyIdAuthFlowFromUrl: () => {
    const info = mockFlowInfo;
    mockFlowInfo = undefined;
    return info;
  },
}));

jest.mock('./useOneKeyAuth', () => ({
  useOneKeyAuth: () => ({
    loginOneKeyId: (params: unknown) => mockLoginOneKeyId(params) as unknown,
  }),
}));

jest.mock(
  '@onekeyhq/kit/src/views/Prime/hooks/usePrimeFreeTrialPendingAction',
  () => ({
    usePrimeFreeTrialPendingActionRunner: () => mockRunPendingAction,
  }),
);

jest.mock('../../background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    servicePrimeFreeTrial: {
      clearPendingActionCreatedBefore: (params: unknown) =>
        mockClearPendingActionCreatedBefore(params) as unknown,
    },
  },
}));

jest.mock(
  '@onekeyhq/kit/src/views/Prime/components/oneKeyIdLoginToastUtils',
  () => ({
    getSanitizedAuthErrorText: () => '',
    logOneKeyIdLoginFailureReason: () => undefined,
  }),
);

jest.mock(
  '../../views/Prime/components/OneKeyIdLegacyOAuthBind/OneKeyIdLegacyOAuthBind',
  () => ({
    showOneKeyIdLegacyOAuthBindDialog: (params: unknown) =>
      mockShowLegacyBind(params) as unknown,
  }),
);

jest.mock('@onekeyhq/shared/src/utils/timerUtils', () => ({
  __esModule: true,
  default: { wait: async () => undefined },
}));

async function mountWithFlow(flow: EExtOneKeyIdAuthFlow) {
  mockFlowInfo = { flow };
  render(<ExtOneKeyIdAuthOnMount />);
  await act(async () => {
    for (let i = 0; i < 10; i += 1) {
      await Promise.resolve();
    }
  });
}

describe('ExtOneKeyIdAuthOnMount free-trial hand-off', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(cleanup);

  it('continues the saved action after the relayed login succeeds', async () => {
    mockLoginOneKeyId.mockResolvedValue(undefined);

    await mountWithFlow(EExtOneKeyIdAuthFlow.Login);

    expect(mockRunPendingAction).toHaveBeenCalledTimes(1);
    expect(mockClearPendingActionCreatedBefore).not.toHaveBeenCalled();
  });

  it('only drops actions saved before a cancelled login started', async () => {
    mockLoginOneKeyId.mockRejectedValue(new PrimeLoginDialogCancelError());
    const before = Date.now();

    await mountWithFlow(EExtOneKeyIdAuthFlow.Login);

    expect(mockRunPendingAction).not.toHaveBeenCalled();
    expect(mockClearPendingActionCreatedBefore).toHaveBeenCalledTimes(1);
    const [{ timestamp }] = mockClearPendingActionCreatedBefore.mock
      .calls[0] as [{ timestamp: number }];
    expect(timestamp).toBeGreaterThanOrEqual(before);
  });

  it('treats a nested hand-off like a cancel of this login', async () => {
    mockLoginOneKeyId.mockRejectedValue(
      new PrimeLoginHandedOffToExtExpandTabError(),
    );

    await mountWithFlow(EExtOneKeyIdAuthFlow.Login);

    expect(mockRunPendingAction).not.toHaveBeenCalled();
  });

  it('never consumes the slot for the legacy OAuth bind flow', async () => {
    mockShowLegacyBind.mockResolvedValue(undefined);

    await mountWithFlow(EExtOneKeyIdAuthFlow.LegacyOAuthBind);

    expect(mockShowLegacyBind).toHaveBeenCalledTimes(1);
    expect(mockLoginOneKeyId).not.toHaveBeenCalled();
    expect(mockRunPendingAction).not.toHaveBeenCalled();
  });
});
