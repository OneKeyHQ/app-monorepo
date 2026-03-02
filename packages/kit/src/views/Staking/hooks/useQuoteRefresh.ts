import { useCallback, useEffect, useRef, useState } from 'react';

type IUseQuoteRefreshParams<T> = {
  enabled?: boolean;
  refreshKey?: number;
  amountValue: string;
  fetchTransactionConfirmation: (amount: string) => Promise<T>;
  setTransactionConfirmation: (resp: T) => void;
  onQuoteReset?: () => void;
  onQuoteRefreshingChange?: (loading: boolean) => void;
};

export function useQuoteRefresh<T>({
  enabled = true,
  refreshKey,
  amountValue,
  fetchTransactionConfirmation,
  setTransactionConfirmation,
  onQuoteReset,
  onQuoteRefreshingChange,
}: IUseQuoteRefreshParams<T>) {
  const [quoteRefreshing, setQuoteRefreshing] = useState(false);
  const requestIdRef = useRef(0);

  // Stabilize doRefreshQuote via ref to avoid effect churn
  const doRefreshQuoteRef = useRef<(() => Promise<void>) | null>(null);
  doRefreshQuoteRef.current = async () => {
    if (!enabled) return;
    if (!amountValue || Number(amountValue) <= 0) return;
    requestIdRef.current += 1;
    const currentRequestId = requestIdRef.current;
    setQuoteRefreshing(true);
    onQuoteRefreshingChange?.(true);
    try {
      const resp = await fetchTransactionConfirmation(amountValue);
      // Discard stale response
      if (currentRequestId !== requestIdRef.current) return;
      setTransactionConfirmation(resp);
      if (resp) {
        onQuoteReset?.();
      }
    } catch {
      // keep stale state
    } finally {
      if (currentRequestId === requestIdRef.current) {
        setQuoteRefreshing(false);
        onQuoteRefreshingChange?.(false);
      }
    }
  };

  // Header refresh: re-fetch when refreshKey changes
  const prevRefreshKeyRef = useRef(refreshKey);
  useEffect(() => {
    if (refreshKey !== undefined && refreshKey !== prevRefreshKeyRef.current) {
      prevRefreshKeyRef.current = refreshKey;
      void doRefreshQuoteRef.current?.();
    }
  }, [refreshKey]);

  // Footer expired-refresh button
  const handleLocalRefreshQuote = useCallback(() => {
    void doRefreshQuoteRef.current?.();
  }, []);

  return { quoteRefreshing, handleLocalRefreshQuote };
}
