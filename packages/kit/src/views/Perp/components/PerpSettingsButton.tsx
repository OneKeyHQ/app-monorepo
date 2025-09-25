import { useCallback } from 'react';

import { IconButton } from '@onekeyhq/components';
import type { IIconButtonProps } from '@onekeyhq/components/src/actions/IconButton';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import { EModalSettingRoutes } from '@onekeyhq/shared/src/routes/setting';

type IPerpSettingsButtonProps = Omit<IIconButtonProps, 'icon' | 'onPress'>;

export function PerpSettingsButton({
  size = 'small',
  variant = 'tertiary',
  ...rest
}: IPerpSettingsButtonProps) {
  const navigation = useAppNavigation();

  const handlePress = useCallback(() => {
    navigation.pushModal(EModalRoutes.SettingModal, {
      screen: EModalSettingRoutes.SettingPerpUserConfig,
    });
  }, [navigation]);

  return (
    <IconButton
      icon="SettingsOutline"
      size={size}
      variant={variant}
      iconColor="$iconSubdued"
      onPress={handlePress}
      {...rest}
    />
  );
}
