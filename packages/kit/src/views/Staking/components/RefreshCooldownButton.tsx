import { memo, useCallback, useEffect, useRef, useState } from 'react';

import { IconButton } from '@onekeyhq/components';

const DEFAULT_COOLDOWN_MS = 5000;

interface IRefreshCooldownButtonProps {
  onPress: () => void;
  loading?: boolean;
  cooldownMs?: number;
  triggerCooldown?: number;
}

function RefreshCooldownButtonComponent({
  onPress,
  loading,
  cooldownMs = DEFAULT_COOLDOWN_MS,
  triggerCooldown = 0,
}: IRefreshCooldownButtonProps) {
  const [isCoolingDown, setIsCoolingDown] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (triggerCooldown === 0) return;

    setIsCoolingDown(true);
    timerRef.current = setTimeout(() => {
      setIsCoolingDown(false);
    }, cooldownMs);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [triggerCooldown, cooldownMs]);

  const handlePress = useCallback(() => {
    if (isCoolingDown || loading) return;
    onPress();
  }, [isCoolingDown, loading, onPress]);

  return (
    <IconButton
      icon="RotateClockwiseOutline"
      variant="tertiary"
      size="small"
      disabled={isCoolingDown || loading}
      onPress={handlePress}
    />
  );
}

export const RefreshCooldownButton = memo(RefreshCooldownButtonComponent);
