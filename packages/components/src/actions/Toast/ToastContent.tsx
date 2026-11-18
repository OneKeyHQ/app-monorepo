import { useEffect, useMemo } from 'react';

import { useWindowDimensions } from 'react-native';

import type { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { getNativeStorageRecoveryToastTarget } from '@onekeyhq/shared/src/storage/nativeStorageTypes';

import { useSettingConfig } from '../../hocs/Provider/hooks/useProviderValue';
import { usePageWidth } from '../../hooks/usePage';
import { useMedia } from '../../hooks/useStyle';
import { View, XStack, YStack } from '../../primitives';

import { NativeStorageRecoveryToastActions } from './NativeStorageRecoveryToastActions';

import type { ISizableTextProps } from '../../primitives';

// The card body for custom toasts (`Toast.show`), whose content is a React
// tree. Message toasts (`Toast.success` and friends) are drawn by the
// platform from data and do not use this component.

const underlineTextPropsStatic = {
  color: '$textSubdued' as const,
};

function RenderLines({
  size,
  children: text,
  color,
}: {
  children?: string;
  size: ISizableTextProps['size'];
  color: ISizableTextProps['color'];
}) {
  const { HyperlinkText } = useSettingConfig();
  if (!text) {
    return null;
  }
  const lines = text?.split('\n') || [];

  if (lines.length === 0) {
    return null;
  }

  return (
    <YStack>
      {lines.map((line, index) => (
        <HyperlinkText
          key={index}
          color={color}
          textTransform="none"
          userSelect="none"
          underlineTextProps={underlineTextPropsStatic}
          size={size}
          wordWrap="break-word"
          translationId={line as ETranslations}
          defaultMessage={line}
        />
      ))}
    </YStack>
  );
}

const platformWebOverflowStyle = {
  overflow: 'hidden' as const,
};

const platformAndroidPaddingStyle = {
  paddingTop: '$0.5' as const,
};

export function ToastContent({
  title,
  message,
  icon,
  maxWidth,
  actions,
  onClose,
  actionsAlign = 'right',
  nativeStorageRecoveryTestSessionId,
  onRequestClose,
}: {
  title: string;
  message?: string;
  maxWidth?: number;
  icon?: JSX.Element;
  onClose?: () => void;
  actions?: JSX.Element | JSX.Element[];
  actionsAlign?: 'left' | 'right';
  nativeStorageRecoveryTestSessionId?: string;
  onRequestClose?: () => void | Promise<void>;
}) {
  const { height } = useWindowDimensions();
  const pageWidth = usePageWidth();
  const media = useMedia();
  useEffect(
    () => () => {
      onClose?.();
    },
    [onClose],
  );
  const platformNativeStyle = useMemo(
    () => ({
      maxHeight: height - 200,
      width: Math.min(pageWidth, 640) - 64,
    }),
    [height, pageWidth],
  );
  return (
    <YStack
      flex={1}
      maxWidth={maxWidth}
      maxHeight={height - 100}
      $platform-native={platformNativeStyle}
      $platform-web={platformWebOverflowStyle}
    >
      <XStack gap={icon ? '$2' : 0}>
        {icon ? (
          <View
            $platform-android={platformAndroidPaddingStyle}
            width="$5.5"
            height="$5.5"
          >
            {icon}
          </View>
        ) : null}

        <YStack flex={1} gap="$1">
          {title ? (
            <RenderLines color="$text" size="$headingSm">
              {title}
            </RenderLines>
          ) : null}

          {message ? (
            <RenderLines
              color="$textSubdued"
              size={media.gtMd ? '$bodyMd' : '$bodySm'}
            >
              {message}
            </RenderLines>
          ) : null}

          {actions ||
          (platformEnv.isNative &&
            getNativeStorageRecoveryToastTarget(title, message)) ? (
            <XStack
              gap="$2"
              justifyContent={
                actionsAlign === 'left' ? 'flex-start' : 'flex-end'
              }
              paddingTop="$3"
              paddingRight="$0.5"
              paddingBottom="$0.5"
            >
              <NativeStorageRecoveryToastActions
                title={title}
                message={message}
                actions={actions}
                nativeStorageRecoveryTestSessionId={
                  nativeStorageRecoveryTestSessionId
                }
                onRequestClose={onRequestClose}
              />
            </XStack>
          ) : null}
        </YStack>
      </XStack>
    </YStack>
  );
}
