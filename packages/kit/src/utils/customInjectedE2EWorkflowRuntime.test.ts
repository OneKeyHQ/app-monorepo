import {
  getCustomInjectedE2EWorkflowActions,
  setCustomInjectedE2EWorkflowActions,
  subscribeCustomInjectedE2EWorkflowActions,
} from './customInjectedE2EWorkflowRuntime';
import {
  acquireCustomInjectedProtocolSelectionLock,
  activateCustomInjectedProtocolRuntime,
  resetCustomInjectedProtocolRuntimeForTest,
} from './customInjectedProtocolRuntime';

const scope = {
  instanceKey: 'instance-1',
  protocolId: 'custom:sushi',
  sessionId: 'session-1',
  tabId: 'tab-1',
};

function workflowActions(e2eRunning: boolean, e2eGenerating = false) {
  return {
    ...scope,
    e2eGenerating,
    e2eRunning,
    startRecording: jest.fn(),
    stopE2E: jest.fn(),
    stopE2EGeneration: jest.fn(),
    stopRecording: jest.fn(),
    validateE2E: jest.fn().mockResolvedValue(undefined),
  };
}

describe('customInjectedE2EWorkflowRuntime', () => {
  afterEach(() => {
    resetCustomInjectedProtocolRuntimeForTest();
  });

  test('keeps stop actions available to validation and generation lock owners', () => {
    activateCustomInjectedProtocolRuntime(scope);
    const idleActions = workflowActions(false);
    const disposeIdleActions = setCustomInjectedE2EWorkflowActions(idleActions);
    const lock = acquireCustomInjectedProtocolSelectionLock({
      reason: 'E2E validation',
      sessionId: scope.sessionId,
    });

    expect(
      getCustomInjectedE2EWorkflowActions({
        protocolId: scope.protocolId,
        sessionId: scope.sessionId,
      }),
    ).toBeUndefined();

    disposeIdleActions();
    const runningActions = workflowActions(true);
    const disposeRunningActions =
      setCustomInjectedE2EWorkflowActions(runningActions);
    expect(
      getCustomInjectedE2EWorkflowActions({
        protocolId: scope.protocolId,
        sessionId: scope.sessionId,
      }),
    ).toBe(runningActions);

    disposeRunningActions();
    const generatingActions = workflowActions(false, true);
    const disposeGeneratingActions =
      setCustomInjectedE2EWorkflowActions(generatingActions);
    expect(
      getCustomInjectedE2EWorkflowActions({
        protocolId: scope.protocolId,
        sessionId: scope.sessionId,
      }),
    ).toBe(generatingActions);

    disposeGeneratingActions();
    lock.release();
  });

  test('notifies consumers when actions or the selection lock changes', () => {
    const listener = jest.fn();
    const unsubscribe = subscribeCustomInjectedE2EWorkflowActions(listener);
    const disposeActions = setCustomInjectedE2EWorkflowActions(
      workflowActions(false),
    );
    const lock = acquireCustomInjectedProtocolSelectionLock({
      reason: 'E2E validation',
      sessionId: scope.sessionId,
    });

    lock.release();
    disposeActions();
    expect(listener).toHaveBeenCalledTimes(4);
    unsubscribe();
  });
});
