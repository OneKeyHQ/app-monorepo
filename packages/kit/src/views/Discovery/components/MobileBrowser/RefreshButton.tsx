import { useCallback, useRef } from 'react';

import { useIntl } from 'react-intl';
import { Animated } from 'react-native';

import { IconButton } from '@onekeyhq/components';
import type { IIconButtonProps } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { DiscoveryTestIDs } from '../../testIDs';

import { CAPSULE_BUTTON_HIT_SLOP } from './browserChrome';
import { ChromePressable } from './ChromePressable';

interface IRefreshButtonProps {
  onRefresh: () => void;
  size?: 'small' | 'medium' | 'large';
  iconSize?: IIconButtonProps['iconSize'];
}

function RefreshButton({
  onRefresh,
  size = 'medium',
  iconSize,
}: IRefreshButtonProps) {
  const intl = useIntl();
  const rotateAnim = useRef(new Animated.Value(0)).current;

  const handleRefresh = useCallback(() => {
    Animated.timing(rotateAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start(() => {
      rotateAnim.setValue(0);
    });
    onRefresh();
  }, [onRefresh, rotateAnim]);

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <ChromePressable
      onPress={handleRefresh}
      hitSlop={CAPSULE_BUTTON_HIT_SLOP}
      accessibilityLabel={intl.formatMessage({
        id: ETranslations.global_refresh,
      })}
    >
      <Animated.View style={{ transform: [{ rotate: spin }] }}>
        <IconButton
          variant="tertiary"
          size={size}
          icon="RefreshCwOutline"
          iconSize={iconSize}
          testID={DiscoveryTestIDs.browserRefreshButton}
        />
      </Animated.View>
    </ChromePressable>
  );
}

export default RefreshButton;
