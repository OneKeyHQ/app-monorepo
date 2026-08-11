import {
  getActiveCustomInjectedProtocolRuntime,
  getCustomInjectedProtocolSelectionLock,
  isCustomInjectedProtocolRuntimeActive,
  subscribeCustomInjectedProtocolSelectionLock,
} from './customInjectedProtocolRuntime';

type ICustomInjectedE2EWorkflowActions = {
  instanceKey: string;
  protocolId: string;
  sessionId: string;
  startRecording: () => void;
  stopRecording: () => void;
  e2eGenerating: boolean;
  stopE2EGeneration: () => void;
  e2eRunning: boolean;
  stopE2E: () => void;
  validateE2E: () => Promise<void>;
};

let activeActions: ICustomInjectedE2EWorkflowActions | undefined;
const actionListeners = new Set<() => void>();

function notifyActionListeners() {
  actionListeners.forEach((listener) => listener());
}

export function getCustomInjectedE2EWorkflowActions({
  protocolId,
  sessionId,
}: {
  protocolId: string;
  sessionId: string;
}) {
  const activeScope = getActiveCustomInjectedProtocolRuntime();
  const selectionLock = getCustomInjectedProtocolSelectionLock();
  if (
    (!selectionLock ||
      ((activeActions?.e2eRunning || activeActions?.e2eGenerating) &&
        selectionLock.sessionId === sessionId)) &&
    activeActions?.protocolId === protocolId &&
    activeActions.sessionId === sessionId &&
    activeActions.instanceKey === activeScope?.instanceKey &&
    isCustomInjectedProtocolRuntimeActive(activeScope)
  ) {
    return activeActions;
  }
  return undefined;
}

export function setCustomInjectedE2EWorkflowActions(
  actions: ICustomInjectedE2EWorkflowActions,
) {
  activeActions = actions;
  notifyActionListeners();
  return () => {
    if (activeActions === actions) {
      activeActions = undefined;
      notifyActionListeners();
    }
  };
}

export function subscribeCustomInjectedE2EWorkflowActions(
  listener: () => void,
) {
  actionListeners.add(listener);
  const unsubscribeSelectionLock =
    subscribeCustomInjectedProtocolSelectionLock(listener);
  return () => {
    actionListeners.delete(listener);
    unsubscribeSelectionLock();
  };
}
