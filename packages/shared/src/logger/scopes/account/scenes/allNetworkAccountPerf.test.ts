import * as diagnostics from '@onekeyhq/shared/src/performance/enabled';

import { AllNetworkAccountPerf } from './allNetworkAccountPerf';

jest.mock('@onekeyhq/shared/src/performance/enabled', () => {
  const actual = jest.requireActual<
    typeof import('@onekeyhq/shared/src/performance/enabled')
  >('@onekeyhq/shared/src/performance/enabled');
  return {
    ...actual,
    isAccountSwitchDiagnosticsEnabled: jest.fn(
      actual.isAccountSwitchDiagnosticsEnabled,
    ),
  };
});

describe('Home account-switch trace gating', () => {
  it('does not emit diagnostic traces by default', () => {
    const scene = new AllNetworkAccountPerf();
    const emit = jest
      .spyOn(scene, '_emitLog')
      .mockImplementation(() => undefined);
    scene.homeTokenListRefreshTrace({ runtime: 'main', phase: 'test' });
    expect(emit).not.toHaveBeenCalled();
  });

  it('writes diagnostic traces to the local log when explicitly enabled', () => {
    const enabledSpy = jest
      .mocked(diagnostics.isAccountSwitchDiagnosticsEnabled)
      .mockReturnValue(true);
    try {
      const scene = new AllNetworkAccountPerf();
      const emit = jest
        .spyOn(scene, '_emitLog')
        .mockImplementation(() => undefined);
      const params = { runtime: 'bg', phase: 'test' } as const;
      scene.homeTokenListRefreshTrace(params);
      expect(emit).toHaveBeenCalledWith(
        'homeTokenListRefreshTrace',
        [params],
        [{ level: 'info', type: 'local' }],
      );
    } finally {
      enabledSpy.mockReturnValue(false);
    }
  });
});
