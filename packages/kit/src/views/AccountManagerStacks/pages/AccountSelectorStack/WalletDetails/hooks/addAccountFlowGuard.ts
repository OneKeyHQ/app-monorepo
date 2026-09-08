let inFlightAddAccountFlow: Promise<void> | undefined;

export function runAddAccountFlowOnce(
  flow: () => Promise<void>,
): Promise<void> {
  if (inFlightAddAccountFlow) {
    return inFlightAddAccountFlow;
  }

  const task = flow();
  inFlightAddAccountFlow = task;
  const clearTask = () => {
    if (inFlightAddAccountFlow === task) {
      inFlightAddAccountFlow = undefined;
    }
  };
  void task.then(clearTask, clearTask);
  return task;
}
