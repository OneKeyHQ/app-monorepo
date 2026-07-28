import { useLayoutEffect } from 'react';

import { useSwapProInputAmountOwnerKeyAtom } from '../../../states/jotai/contexts/swap/atoms';

export function useSwapProInputAmountOwnerChange({
  accountOwnerKey,
  enabled,
  onOwnerChange,
}: {
  accountOwnerKey: string;
  enabled: boolean;
  onOwnerChange: () => void;
}) {
  const [lastOwnerKey, setLastOwnerKey] = useSwapProInputAmountOwnerKeyAtom();

  useLayoutEffect(() => {
    if (!enabled || !accountOwnerKey) {
      return;
    }

    if (lastOwnerKey === accountOwnerKey) {
      return;
    }

    setLastOwnerKey(accountOwnerKey);
    if (lastOwnerKey && lastOwnerKey !== accountOwnerKey) {
      onOwnerChange();
    }
  }, [accountOwnerKey, enabled, lastOwnerKey, onOwnerChange, setLastOwnerKey]);
}
