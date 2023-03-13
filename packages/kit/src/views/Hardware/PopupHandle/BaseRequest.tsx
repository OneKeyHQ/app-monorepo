import type { FC, ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';

import {
  Box,
  Center,
  IconButton,
  Spinner,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import type { IBoxProps } from 'native-base';

export type CloseWay = 'delay' | 'now' | 'never';

export type BaseRequestViewProps = {
  children: ReactNode;
  mobileFillWidth?: boolean;
  loading?: boolean;
  closeWay?: CloseWay;
  onCancel: () => void;
  onClose?: () => void;
} & IBoxProps;

const defaultProps = {
  mobileFillWidth: false,
  popupType: 'normal',
  closeWay: 'delay',
} as const;

const BaseRequestView: FC<BaseRequestViewProps> = ({
  children,
  mobileFillWidth,
  loading,
  closeWay,
  onCancel,
  onClose,
  ...rest
}) => {
  const [showClose, setShowClose] = useState(false);
  const { bottom } = useSafeAreaInsets();

  const mobileFill = useMemo(
    () => platformEnv.isNative && mobileFillWidth,
    [mobileFillWidth],
  );

  useEffect(() => {
    if (closeWay === 'never') return;
    if (closeWay === 'now') return setShowClose(true);

    const timer = setTimeout(() => {
      setShowClose(true);
    }, 30 * 1000);

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [closeWay]);

  return (
    <Box px={mobileFill ? 0 : 6} w="full" maxW={mobileFill ? 'full' : '374'}>
      <Box
        w="full"
        mx="auto"
        p={4}
        {...(bottom && { pb: `${bottom}px` })}
        rounded="xl"
        bgColor="surface-default"
        borderWidth={1}
        borderColor="border-subdued"
        shadow="depth.4"
        {...rest}
      >
        {children}

        {!!showClose && (
          <IconButton
            onPress={() => {
              onCancel?.();
              onClose?.();
            }}
            position="absolute"
            top={1}
            right={1}
            type="plain"
            circle
            name="XMarkMini"
          />
        )}

        {!!loading && (
          <Center w="full" h="full" top={0} right={0} position="absolute">
            <Spinner size="lg" />
          </Center>
        )}
      </Box>
    </Box>
  );
};

BaseRequestView.defaultProps = defaultProps;
export default BaseRequestView;
