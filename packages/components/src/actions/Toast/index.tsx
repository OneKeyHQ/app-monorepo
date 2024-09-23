import type { RefObject } from 'react';
import { createRef } from 'react';

import { ToastProvider } from '@tamagui/toast';
import { useWindowDimensions } from 'react-native';
import { useMedia } from 'tamagui';

import { dismissKeyboard } from '@onekeyhq/shared/src/keyboard';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { Portal } from '../../hocs';
import {
  Anchor,
  Icon,
  SizableText,
  View,
  XStack,
  YStack,
} from '../../primitives';

import { ShowCustom, ShowToasterClose } from './ShowCustom';
import { showMessage } from './showMessage';

import type { IShowToasterInstance, IShowToasterProps } from './ShowCustom';
import type { IPortalManager } from '../../hocs';
import type { ISizableTextProps } from '../../primitives';

export interface IToastProps {
  toastId?: string;
  title: string;
  message?: string;
  duration?: number;
  actions?: JSX.Element | JSX.Element[];
}

export interface IToastBaseProps extends IToastProps {
  title: string;
  message?: string;
  duration?: number;
  haptic?: 'success' | 'warning' | 'info' | 'error' | 'none';
  preset?: 'done' | 'error' | 'none' | 'custom';
}

const iconMap = {
  success: <Icon name="CheckRadioSolid" color="$iconSuccess" size="$5" />,
  error: <Icon name="XCircleSolid" color="$iconCritical" size="$5" />,
  info: <Icon name="InfoCircleSolid" color="$iconInfo" size="$5" />,
  warning: <Icon name="ErrorSolid" color="$iconCaution" size="$5" />,
};

const urlRegex = /<url(?:\s+[^>]*?)?>(.*?)<\/url>/g;
const RenderLines = ({
  size,
  children: text,
  color,
}: {
  children?: string;
  size: ISizableTextProps['size'];
  color: ISizableTextProps['color'];
}) => {
  if (!text) {
    return null;
  }
  const lines = text?.split('\n') || [];

  if (lines.length === 0) {
    return null;
  }

  return (
    <YStack>
      {lines.map((line, index) => {
        const hasUrl = urlRegex.test(line);
        if (!hasUrl) {
          return (
            <SizableText
              key={index}
              color={color}
              textTransform="none"
              userSelect="none"
              size={size}
              wordWrap="break-word"
            >
              {line}
            </SizableText>
          );
        }
        const parts = line.split(urlRegex);
        const hrefMatch = line.match(/href="(.*?)"/);
        return (
          <SizableText
            key={index}
            color={color}
            textTransform="none"
            userSelect="none"
            size={size}
            wordWrap="break-word"
          >
            {parts.map((part, partIndex) => {
              if (partIndex % 2 === 1) {
                return (
                  <Anchor
                    key={partIndex}
                    href={hrefMatch?.[1]}
                    target="_blank"
                    size={size}
                    color="$textInfo"
                  >
                    {part}
                  </Anchor>
                );
              }
              return part;
            })}
          </SizableText>
        );
      })}
    </YStack>
  );
};

export function ToastContent({
  title,
  message,
  icon,
  maxWidth,
  actions,
  actionsAlign = 'right',
}: {
  title: string;
  message?: string;
  maxWidth?: number;
  icon?: JSX.Element;
  actions?: IToastProps['actions'];
  actionsAlign?: 'left' | 'right';
}) {
  const { height, width } = useWindowDimensions();
  const media = useMedia();

  return (
    <YStack
      flex={1}
      maxWidth={maxWidth}
      maxHeight={height - 100}
      $platform-native={{
        maxHeight: height - 200,
        width: media.md ? width - 64 : 640,
      }}
      $platform-web={{
        overflow: 'hidden',
      }}
    >
      <XStack gap={icon ? '$2' : 0}>
        {icon ? (
          <View
            $platform-android={{
              paddingTop: '$0.5',
            }}
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
              size={media.md ? '$bodySm' : '$bodyMd'}
            >
              {message}
            </RenderLines>
          ) : null}

          {actions ? (
            <XStack
              gap="$2"
              justifyContent={
                actionsAlign === 'left' ? 'flex-start' : 'flex-end'
              }
              paddingTop="$3"
              paddingRight="$0.5"
              paddingBottom="$0.5"
            >
              {actions}
            </XStack>
          ) : null}
        </YStack>
      </XStack>
    </YStack>
  );
}

const toastIdMap = new Map<string, [number, number]>();
function toastMessage({
  toastId,
  title,
  message,
  duration = 5000,
  haptic,
  preset = 'custom',
  actions,
}: IToastBaseProps) {
  if (platformEnv.isDev) {
    if (title.length === 0) {
      throw new Error(`The parameter 'title' cannot be an empty string`);
    }
  }
  if (toastId) {
    if (toastIdMap.has(toastId)) {
      const [createdAt, toastDuration] = toastIdMap.get(toastId) as [
        number,
        number,
      ];
      if (Date.now() - createdAt < toastDuration) {
        return;
      }
      toastIdMap.delete(toastId);
    }

    toastIdMap.set(toastId, [Date.now(), duration + 500]);
  }
  showMessage({
    renderContent: (props) => (
      <ToastContent
        title={title}
        maxWidth={props?.width}
        message={message}
        icon={iconMap[haptic as keyof typeof iconMap]}
        actions={actions}
      />
    ),
    duration,
    haptic,
    preset,
  });
}

export { default as Toaster } from './Toaster';

export type IToastShowResult = {
  close: (extra?: { flag?: string }) => void | Promise<void>;
};
export const Toast = {
  success: (props: IToastProps) => {
    toastMessage({ haptic: 'success', ...props });
  },
  error: (props: IToastProps) => {
    toastMessage({ haptic: 'error', ...props });
  },
  warning: (props: IToastProps) => {
    toastMessage({ haptic: 'warning', ...props });
  },
  message: (props: IToastProps) => {
    toastMessage({ haptic: 'info', preset: 'none', ...props });
  },
  /* show custom view on Toast */
  show: ({
    onClose,
    children,
    ...others
  }: IShowToasterProps): IToastShowResult => {
    dismissKeyboard();
    let instanceRef: RefObject<IShowToasterInstance> | undefined =
      createRef<IShowToasterInstance>();
    let portalRef:
      | {
          current: IPortalManager;
        }
      | undefined;

    const handleClose = (extra?: { flag?: string }) =>
      new Promise<void>((resolve) => {
        // Remove the React node after the animation has finished.
        setTimeout(() => {
          if (instanceRef) {
            instanceRef = undefined;
          }
          if (portalRef) {
            portalRef.current.destroy();
            portalRef = undefined;
          }
          void onClose?.(extra);
          resolve();
        }, 300);
      });
    portalRef = {
      current: Portal.Render(
        Portal.Constant.TOASTER_OVERLAY_PORTAL,
        <ShowCustom ref={instanceRef} onClose={handleClose} {...others}>
          {children}
        </ShowCustom>,
      ),
    };
    const close = async (extra?: { flag?: string }, times = 0) => {
      if (times > 10) {
        return;
      }
      if (!instanceRef?.current) {
        setTimeout(() => {
          void close(extra, times + 1);
        }, 10);
        return Promise.resolve();
      }
      return instanceRef?.current?.close(extra);
    };
    const r: IToastShowResult = {
      close,
    };
    return r;
  },
  Close: ShowToasterClose,
};

export { useToaster } from './ShowCustom';
export type { IShowToasterProps } from './ShowCustom';

export function ShowToastProvider() {
  return (
    <ToastProvider swipeDirection="up">
      <Portal.Container name={Portal.Constant.TOASTER_OVERLAY_PORTAL} />
    </ToastProvider>
  );
}
