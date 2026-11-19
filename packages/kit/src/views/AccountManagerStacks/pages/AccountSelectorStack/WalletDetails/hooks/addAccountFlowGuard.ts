const inFlightAddAccountFlows = new Map<string, Promise<void>>();

export function runAddAccountFlowOnce(
  walletId: string,
  flow: () => Promise<void>,
): Promise<void> {
  const inFlightFlow = inFlightAddAccountFlows.get(walletId);
  if (inFlightFlow) {
    return inFlightFlow;
  }

  const task = flow();
  inFlightAddAccountFlows.set(walletId, task);
  const clearTask = () => {
    if (inFlightAddAccountFlows.get(walletId) === task) {
      inFlightAddAccountFlows.delete(walletId);
    }
  };
  void task.then(clearTask, clearTask);
  return task;
}
