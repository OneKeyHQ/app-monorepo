type IReservation<TController> = {
  controller: TController;
  token: symbol;
  recoveryLease?: symbol;
};

/** Retains a task owner and serializes explicit recovery within this runtime. */
export function createEarnTaskReservationRegistry<TKey, TController>() {
  const entries = new Map<TKey, IReservation<TController>>();
  return {
    find: (key: TKey) => entries.get(key),
    reserve: (key: TKey, controller: TController) => {
      if (entries.has(key)) return undefined;
      const token = Symbol('earn-task-reservation');
      entries.set(key, { controller, token });
      return token;
    },
    release: (key: TKey, token: symbol) => {
      if (entries.get(key)?.token !== token) return false;
      return entries.delete(key);
    },
    acquireRecovery: (key: TKey, token: symbol) => {
      const entry = entries.get(key);
      if (!entry || entry.token !== token || entry.recoveryLease)
        return undefined;
      const lease = Symbol('earn-task-recovery');
      entry.recoveryLease = lease;
      return lease;
    },
    releaseRecovery: (key: TKey, token: symbol, lease: symbol) => {
      const entry = entries.get(key);
      if (!entry || entry.token !== token || entry.recoveryLease !== lease)
        return false;
      entry.recoveryLease = undefined;
      return true;
    },
  };
}
