import { useCallback, useMemo, useState } from 'react';

import { HeaderIconButton, Toast } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useThemeVariant } from '@onekeyhq/kit/src/hooks/useThemeVariant';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import { EPrimePages } from '@onekeyhq/shared/src/routes/prime';

import { usePrivyUniversalV2 } from '../../hooks/usePrivyUniversalV2';

export function PrimeHeaderIconButton() {
  const { user, isReady } = usePrivyUniversalV2();
  const navigation = useAppNavigation();
  const [isHover, setIsHover] = useState(false);
  const themeVariant = useThemeVariant();

  const icon = useMemo(
    () =>
      themeVariant === 'light'
        ? 'OnekeyPrimeLightColored'
        : 'OnekeyPrimeDarkColored',
    [themeVariant],
  );

  const onPrimeButtonPressed = useCallback(() => {
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
  }, [navigation, isReady]);

  return (
    <HeaderIconButton
      onPointerEnter={() => setIsHover(true)}
      onPointerLeave={() => setIsHover(false)}
      key="header-prime-button"
      title="Prime"
      icon={user?.id || isHover ? icon : 'PrimeOutline'}
      tooltipProps={{
        open: isHover,
      }}
      onPress={onPrimeButtonPressed}
    />
  );
}
