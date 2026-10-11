import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { AccountSelectorPerfScene } from './perf';
import {
  drainAccountSelectorPerfE2ETrace,
  recordAccountSelectorPerfE2ETrace,
} from './perfE2E';

describe('account selector E2E trace storage', () => {
  afterEach(() => {
    drainAccountSelectorPerfE2ETrace();
    jest.restoreAllMocks();
  });

  it('collects traces emitted by the real E2E scene into the shared buffer', () => {
    jest.replaceProperty(platformEnv, 'isE2E', true);
    const scene = new AccountSelectorPerfScene();
    scene.trace('selectionStateUpdated', { num: 0 });

    expect(drainAccountSelectorPerfE2ETrace()).toEqual({
      droppedCount: 0,
      events: [
        {
          event: 'selectionStateUpdated',
          num: 0,
          runtimeRole: platformEnv.runtimeRole,
        },
      ],
    });
    expect(drainAccountSelectorPerfE2ETrace()).toEqual({
      droppedCount: 0,
      events: [],
    });
  });

  it('does not collect traces outside E2E', () => {
    jest.replaceProperty(platformEnv, 'isE2E', false);
    new AccountSelectorPerfScene().trace('selectionStateUpdated', { num: 0 });
    expect(drainAccountSelectorPerfE2ETrace().events).toEqual([]);
  });

  it('retains the bounded buffer and dropped-event accounting', () => {
    for (let transitionId = 0; transitionId <= 10_000; transitionId += 1) {
      recordAccountSelectorPerfE2ETrace({
        event: 'selectionStateUpdated',
        transitionId,
      });
    }
    const { droppedCount, events } = drainAccountSelectorPerfE2ETrace();
    expect(droppedCount).toBe(2000);
    expect(events).toHaveLength(8001);
    expect(events[0].transitionId).toBe(2000);
    expect(events.at(-1)?.transitionId).toBe(10_000);
    expect(drainAccountSelectorPerfE2ETrace().droppedCount).toBe(0);
  });
});
