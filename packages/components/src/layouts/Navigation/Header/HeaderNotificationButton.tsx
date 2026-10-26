import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { SizableText, Stack } from '../../../primitives';

import HeaderIconButton from './HeaderIconButton';

import type { IIconButtonProps } from '../../../actions';

export interface IHeaderNotificationButtonProps {
  size?: IIconButtonProps['size'];
  iconSize?: IIconButtonProps['iconSize'];
  title?: string;
  showBadge?: boolean;
  badgeCount?: number;
  onPress?: () => void;
  disabled?: boolean;
  testID?: string;
}

function HeaderNotificationButton({
  size,
  iconSize,
  title,
  showBadge = false,
  badgeCount,
  onPress,
  disabled = false,
  testID = 'headerNotificationButton',
}: IHeaderNotificationButtonProps) {
  return (
    <Stack
      testID={testID}
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      position="relative"
      className="app-region-no-drag"
    >
      <HeaderIconButton
        size={size}
        icon="BellOutline"
        iconSize={iconSize}
        title={title}
        onPress={platformEnv.isNative ? onPress : undefined}
        disabled={disabled}
      />
      {showBadge ? (
        <Stack
          position="absolute"
          right="$-2.5"
          top="$-2"
          alignItems="flex-end"
          w="$10"
          pointerEvents="none"
          opacity={disabled ? 0.5 : 1}
        >
          <Stack
            bg="$bgApp"
            borderRadius="$full"
            borderWidth={2}
            borderColor="$transparent"
          >
            <Stack
              px="$1"
              borderRadius="$full"
              bg="$bgCriticalStrong"
              minWidth="$4"
              height="$4"
              alignItems="center"
              justifyContent="center"
            >
              {badgeCount === undefined ? (
                <Stack
                  width="$1"
                  height="$1"
                  backgroundColor="white"
                  borderRadius="$full"
                />
              ) : (
                <SizableText color="$textOnColor" size="$bodySm">
                  {badgeCount > 99 ? '99+' : badgeCount}
                </SizableText>
              )}
            </Stack>
          </Stack>
        </Stack>
      ) : null}
    </Stack>
  );
}

export default HeaderNotificationButton;
