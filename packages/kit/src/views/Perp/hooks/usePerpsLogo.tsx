/* eslint-disable @typescript-eslint/no-unsafe-return */
import { useMemo } from 'react';

import { useThemeVariant } from '../../../hooks/useThemeVariant';

export function usePerpsLogo() {
  const themeVariant = useThemeVariant();

  const poweredByHyperliquidLogo = useMemo(
    () =>
      themeVariant === 'light'
        ? require('@onekeyhq/kit/assets/perps/PoweredByHyperliquidLight.svg')
        : require('@onekeyhq/kit/assets/perps/PoweredByHyperliquidDark.svg'),
    [themeVariant],
  );

  const hyperliquidLogo = useMemo(
    () =>
      themeVariant === 'light'
        ? require('@onekeyhq/kit/assets/perps/hyperliquid-logo-light.png')
        : require('@onekeyhq/kit/assets/perps/hyperliquid-logo-dark.png'),
    [themeVariant],
  );

  return {
    poweredByHyperliquidLogo,
    hyperliquidLogo,
  };
}
