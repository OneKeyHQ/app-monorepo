import { useCallback, useMemo, useState } from 'react';

import { HeaderIconButton, Stack, Toast } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useThemeVariant } from '@onekeyhq/kit/src/hooks/useThemeVariant';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import { EPrimePages } from '@onekeyhq/shared/src/routes/prime';

import { usePrimeAuthV2 } from '../../hooks/usePrimeAuthV2';

export function PrimeHeaderIconButton({
  onPress,
}: {
  onPress?: () => void | Promise<void>;
}) {
  const { isReady, user } = usePrimeAuthV2();
  const navigation = useAppNavigation();
  const [isHover, setIsHover] = useState(false);
  const themeVariant = useThemeVariant();

  // const icon = useMemo(
  //   () =>
  //     themeVariant === 'light'
  //       ? 'OnekeyPrimeLightColored'
  //       : 'OnekeyPrimeDarkColored',
  //   [themeVariant],
  // );

  const onPrimeButtonPressed = useCallback(async () => {
    if (onPress) {
      await onPress();
    }
    if (!isReady) {
      Toast.message({
        title: 'Prime not ready.',
      });
      return;
    }

    navigation.pushFullModal(EModalRoutes.PrimeModal, {
      screen: EPrimePages.PrimeDashboard,
    });

    setIsHover(false);
  }, [onPress, isReady, navigation]);

  return (
    <Stack testID="headerRightPrimeButton">
      <HeaderIconButton
        onPointerEnter={() => setIsHover(true)}
        onPointerLeave={() => setIsHover(false)}
        title="Prime"
        // icon={user?.privyUserId || isHover ? icon : 'PrimeOutline'}
        icon="PrimeOutline"
        tooltipProps={{
          open: isHover,
        }}
        onPress={onPrimeButtonPressed}
      />
    </Stack>
  );
}
