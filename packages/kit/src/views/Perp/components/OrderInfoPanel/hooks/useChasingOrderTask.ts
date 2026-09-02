import { useCallback, useRef, useState } from 'react';

export function useChasingOrderTask() {
  const [chasingOrderIds, setChasingOrderIds] = useState<Set<number>>(
    () => new Set(),
  );
  const chasingOrderIdsRef = useRef(new Set<number>());

  const isChasingOrder = useCallback(
    (oid: number) => chasingOrderIdsRef.current.has(oid),
    [],
  );
  const runChasingOrderTask = useCallback(
    async (oid: number, task: () => Promise<void>) => {
      if (chasingOrderIdsRef.current.has(oid)) {
        return false;
      }

      chasingOrderIdsRef.current.add(oid);
      setChasingOrderIds((previous) => new Set(previous).add(oid));
      try {
        await task();
        return true;
      } finally {
        chasingOrderIdsRef.current.delete(oid);
        setChasingOrderIds((previous) => {
          const next = new Set(previous);
          next.delete(oid);
          return next;
        });
      }
    },
    [],
  );

  return {
    chasingOrderIds,
    isChasingOrder,
    runChasingOrderTask,
  };
}
