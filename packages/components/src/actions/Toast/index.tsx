import type { RefObject } from 'react';
import { createRef } from 'react';

import { ToastProvider } from '@tamagui/toast';
import { useWindowDimensions } from 'react-native';
import { SizableText, YStack } from 'tamagui';

import { Portal } from '../../hocs';
import { Button, Icon, XStack } from '../../primitives';

import { ShowCustom, ShowToasterClose } from './ShowCustom';
import { showMessage } from './showMessage';

import type { IShowToasterInstance, IShowToasterProps } from './ShowCustom';
import type { IPortalManager } from '../../hocs';
import type { IButtonProps, ISizableTextProps } from '../../primitives';

export interface IToastProps {
  title: string;
  message?: string;
  /**
   * Duration in seconds.
   */
  duration?: number;
  actionsProps?: IButtonProps;
}

export interface IToastBaseProps extends IToastProps {
  title: string;
  message?: string;
  /**
   * Duration in seconds.
   */
  duration?: number;
  haptic?: 'success' | 'warning' | 'error' | 'none';
  preset?: 'done' | 'error' | 'none' | 'custom';
}

const iconMap = {
  success: <Icon name="CheckRadioSolid" color="$iconSuccess" size="$5" />,
  error: <Icon name="XCircleSolid" color="$iconCritical" size="$5" />,
};

const RenderLines = ({
  icon,
  size,
  children: text,
  hasMessage = false,
  maxWidth,
}: {
  children?: string;
  size: ISizableTextProps['size'];
  icon?: JSX.Element;
  hasMessage?: boolean;
  maxWidth?: number;
}) => {
  if (!text) {
    return null;
  }
  const lines = text?.split('\n') || [];
  return lines.length > 0 ? (
    <YStack>
      {lines.map((v, index) =>
        index === 0 ? (
          <XStack
            $platform-native={{
              justifyContent: hasMessage ? 'flex-start' : 'center',
            }}
            alignItems="center"
            key={index}
            space="$1.5"
          >
            <XStack flexShrink={0}>{icon}</XStack>
            <SizableText
              flexShrink={1}
              selectable={false}
              size={size}
              wordWrap="break-word"
            >
              {v}
            </SizableText>
          </XStack>
        ) : (
          <SizableText
            selectable={false}
            $platform-native={{
              textAlign: 'center',
            }}
            size={size}
            wordWrap="break-word"
            width="100%"
            key={index}
          >
            {v}
          </SizableText>
        ),
      )}
    </YStack>
  ) : (
    icon
  );
};

function Title({
  title,
  message,
  icon,
  maxWidth,
  actionsProps,
}: {
  title: string;
  message?: string;
  maxWidth?: number;
  icon?: JSX.Element;
  actionsProps?: IToastProps['actionsProps'];
}) {
  const { height } = useWindowDimensions();
  return (
    <YStack
      flex={1}
      maxWidth={maxWidth}
      maxHeight={height - 100}
      $platform-native={{
        maxHeight: height - 200,
      }}
      $platform-web={{
        overflow: 'hidden',
      }}
    >
      <YStack>
        <RenderLines
          maxWidth={maxWidth}
          size="$headingSm"
          icon={icon}
          hasMessage={!!message}
        >
          {title}
        </RenderLines>
        <RenderLines maxWidth={maxWidth} size="$bodySm">
          {message}
        </RenderLines>
        {actionsProps ? <Button {...actionsProps} /> : null}
      </YStack>
    </YStack>
  );
}

function toastMessage({
  title,
  message,
  duration = 5000,
  haptic,
  preset = 'custom',
  actionsProps,
}: IToastBaseProps) {
  showMessage({
    renderContent: (props) => (
      <Title
        title={title}
        maxWidth={props?.width}
        message={message}
        icon={iconMap[haptic as keyof typeof iconMap]}
        actionsProps={actionsProps}
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
  message: (props: IToastProps) => {
    toastMessage({ haptic: 'warning', preset: 'none', ...props });
  },
  /* show custom view on Toast */
  show: ({
    onClose,
    children,
    ...others
  }: IShowToasterProps): IToastShowResult => {
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
    const r: IToastShowResult = {
      close: async (extra?: { flag?: string }) =>
        instanceRef?.current?.close(extra),
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
