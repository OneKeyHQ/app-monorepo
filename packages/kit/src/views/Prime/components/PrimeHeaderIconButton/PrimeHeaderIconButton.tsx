import { useCallback, useState } from 'react';

import { HeaderIconButton, Stack } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import { EPrimePages } from '@onekeyhq/shared/src/routes/prime';

import { PrimeTestIDs } from '../../testIDs';
import { usePrimeIconName } from '../PrimeUserBadge';

export function useOnPrimeButtonPressed({
  onPress,
  networkId,
}: {
  onPress?: () => void | Promise<void>;
  networkId?: string;
}) {
  const navigation = useAppNavigation();
  const [isHover, setIsHover] = useState(false);
  const icon = usePrimeIconName();

  const onPrimeButtonPressed = useCallback(async () => {
    if (onPress) {
      await onPress();
    }

    navigation.pushFullModal(EModalRoutes.PrimeModal, {
      screen: EPrimePages.PrimeDashboard,
      params: {
        networkId,
      },
    });

    setIsHover(false);
  }, [onPress, navigation, networkId]);

  const onPointerEnter = useCallback(() => {
    setIsHover(true);
  }, []);

  const onPointerLeave = useCallback(() => {
    setIsHover(false);
  }, []);

  return {
    isHover,
    onPointerEnter,
    onPointerLeave,
    onPrimeButtonPressed,
    icon,
  };
}

export function PrimeHeaderIconButton({
  onPress,
  networkId,
}: {
  onPress?: () => void | Promise<void>;
  networkId?: string;
}) {
  const {
    isHover,
    onPointerEnter,
    onPointerLeave,
    onPrimeButtonPressed,
    icon,
  } = useOnPrimeButtonPressed({ onPress, networkId });
  return (
    <Stack testID={PrimeTestIDs.primeHeaderBtn}>
      <HeaderIconButton
        onPointerEnter={onPointerEnter}
        onPointerLeave={onPointerLeave}
        title="Prime"
        icon={icon}
        tooltipProps={{
          open: isHover,
        }}
        onPress={onPrimeButtonPressed}
      />
    </Stack>
  );
}
