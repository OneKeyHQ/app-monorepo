import { useCallback, useMemo, useState } from 'react';

import { HeaderIconButton, Stack, Toast } from '@onekeyhq/components';
import { useOneKeyAuth } from '@onekeyhq/kit/src/components/OneKeyAuth/useOneKeyAuth';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useThemeVariant } from '@onekeyhq/kit/src/hooks/useThemeVariant';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import { EPrimePages } from '@onekeyhq/shared/src/routes/prime';

export function PrimeHeaderIconButton({
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
    return 'PrimeOutline';
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

  return (
    <Stack testID="headerRightPrimeButton">
      <HeaderIconButton
        onPointerEnter={() => setIsHover(true)}
        onPointerLeave={() => setIsHover(false)}
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
