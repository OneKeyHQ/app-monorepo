import { useCallback, useMemo, useState } from 'react';

import type { IKeyOfIcons } from '@onekeyhq/components';
import { HeaderIconButton, Stack, Toast } from '@onekeyhq/components';
import { useOneKeyAuth } from '@onekeyhq/kit/src/components/OneKeyAuth/useOneKeyAuth';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useThemeVariant } from '@onekeyhq/kit/src/hooks/useThemeVariant';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import { EPrimePages } from '@onekeyhq/shared/src/routes/prime';

export function useOnPrimeButtonPressed({
  onPress,
  networkId,
}: {
  onPress?: () => void | Promise<void>;
  networkId?: string;
}) {
  const { isReady, user } = useOneKeyAuth();
  const isPrime = user?.primeSubscription?.isActive;

  const navigation = useAppNavigation();
  const [isHover, setIsHover] = useState(false);
  const themeVariant = useThemeVariant();

  const icon = useMemo(() => {
    if (isPrime && user?.onekeyUserId) {
      return themeVariant === 'light'
        ? 'OnekeyPrimeLightColored'
        : 'OnekeyPrimeDarkColored';
    }
    return 'PrimeOutline' as IKeyOfIcons;
  }, [isPrime, themeVariant, user?.onekeyUserId]);

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
    <Stack testID="headerRightPrimeButton">
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
