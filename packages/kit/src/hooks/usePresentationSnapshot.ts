import { useEffect, useRef, useState } from 'react';

// Only the page selects readiness signals and owns the presentation budget.
export function usePresentationSnapshot<
  T extends {
    hasResolved: boolean;
    presentationScope: string;
  },
>(
  candidate: T,
  {
    preloadScope,
    preload,
    valuesReady,
    budgetMs,
  }: {
    preloadScope: string;
    preload: () => Promise<void>;
    valuesReady: boolean;
    budgetMs: number;
  },
) {
  const [retained, setRetained] = useState(candidate);
  const presented =
    candidate.hasResolved &&
    candidate.presentationScope === retained.presentationScope
      ? candidate
      : retained;
  const candidateRef = useRef(candidate);
  candidateRef.current = candidate;
  const preloadRef = useRef(preload);
  preloadRef.current = preload;
  useEffect(() => {
    if (
      candidate.hasResolved &&
      candidate.presentationScope === retained.presentationScope
    ) {
      setRetained(candidate);
    }
  }, [candidate, retained.presentationScope]);
  const pendingScope =
    candidate.hasResolved &&
    candidate.presentationScope !== retained.presentationScope
      ? candidate.presentationScope
      : undefined;
  const waitRef = useRef<{ scope?: string; id: number }>({ id: 0 });
  if (waitRef.current.scope !== pendingScope) {
    waitRef.current = { scope: pendingScope, id: waitRef.current.id + 1 };
  }
  const waitId = waitRef.current.id;
  const [imagesReadyId, setImagesReadyId] = useState<number>();
  const [expiredId, setExpiredId] = useState<number>();
  useEffect(() => {
    if (!pendingScope) return;
    const timer = setTimeout(() => setExpiredId(waitId), budgetMs);
    return () => clearTimeout(timer);
  }, [pendingScope, waitId, budgetMs]);
  useEffect(() => {
    if (!pendingScope) return;
    let cancelled = false;
    void preloadRef.current().then(() => {
      if (!cancelled) setImagesReadyId(waitId);
    });
    return () => {
      cancelled = true;
    };
  }, [pendingScope, waitId, preloadScope]);
  useEffect(() => {
    if (!pendingScope) return;
    const ready =
      expiredId === waitId || (imagesReadyId === waitId && valuesReady);
    const latest = candidateRef.current;
    if (
      ready &&
      latest.hasResolved &&
      latest.presentationScope === pendingScope
    ) {
      setRetained(latest);
    }
  }, [expiredId, imagesReadyId, valuesReady, pendingScope, waitId]);
  return presented;
}
