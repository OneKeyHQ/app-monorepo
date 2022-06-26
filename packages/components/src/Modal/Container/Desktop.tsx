/* eslint-disable @typescript-eslint/no-unsafe-call */
import React, { isValidElement, useEffect } from 'react';

import { useNavigation, useNavigationState } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import Box from '../../Box';
import Button from '../../Button';
import HStack from '../../HStack';
import IconButton from '../../IconButton';
import Pressable from '../../Pressable';
import Typography from '../../Typography';

import useModalClose from './useModalClose';

import type { ModalProps } from '..';

function modalSizing(modalSize: string | undefined) {
  switch (modalSize) {
    case 'xs':
      return '400px';
    case 'sm':
      return '480px';
    case 'md':
      return '560px';
    case 'lg':
      return '640px';
    case 'xl':
      return '720px';
    case '2xl':
      return '800px';
    default:
      return '';
  }
}

const DesktopModal = ({
  children,
  onClose,
  closeable,
  footer,
  primaryActionProps,
  secondaryActionProps,
  primaryActionTranslationId,
  secondaryActionTranslationId,
  hideSecondaryAction,
  hidePrimaryAction,
  onBackActionPress,
  onPrimaryActionPress,
  onSecondaryActionPress,
  header,
  headerShown,
  size,
  height,
  maxHeight,
  headerDescription,
  closeAction,
  closeOnOverlayClick,
}: ModalProps) => {
  const intl = useIntl();
  const navigation = useNavigation();
  const index = useNavigationState((state) => state.index);

  const defaultClose = useModalClose({ onClose });

  const close = closeAction || defaultClose;

  useEffect(() => {
    if (platformEnv.isRuntimeBrowser) {
      const closeOnEsc = (e: KeyboardEvent) => {
        if (e.code === 'Escape') {
          close();
        }
      };
      document.addEventListener('keydown', closeOnEsc);
      return () => {
        document.removeEventListener('keydown', closeOnEsc);
      };
    }
  }, [close]);
  return (
    <Box
      position="absolute"
      top="0"
      left="0"
      right="0"
      bottom="0"
      justifyContent="center"
      alignItems="center"
      bg="rgba(0, 0, 0, 0.6)"
    >
      {closeOnOverlayClick && (
        <Pressable
          _web={{
            // @ts-ignore
            cursor: 'default',
          }}
          position="absolute"
          top="0"
          left="0"
          right="0"
          bottom="0"
          onPress={close}
        />
      )}
      <Box
        width={modalSizing(size)}
        height={height}
        maxHeight={maxHeight}
        alignSelf="center"
        borderRadius="24px"
        bg="surface-subdued"
        zIndex={1}
      >
        {!!headerShown && (
          <Box
            pt={4}
            pr={4}
            pl={index ? 4 : 6}
            pb={header ? 4 : 0}
            display="flex"
            flexDirection="row"
            justifyContent="space-between"
            alignItems="center"
            borderBottomColor="border-subdued"
            borderBottomWidth={header ? 1 : undefined}
          >
            {index ? (
              <IconButton
                size="base"
                name="ArrowLeftSolid"
                type="plain"
                circle
                onPress={() => {
                  if (onBackActionPress) {
                    onBackActionPress();
                    return;
                  }
                  if (navigation.canGoBack()) {
                    navigation.goBack();
                  }
                }}
              />
            ) : null}
            <Box flex="1" ml={index ? 4 : undefined}>
              <Typography.Heading>{header}</Typography.Heading>
              {!!headerDescription && (
                <Box>
                  {typeof headerDescription === 'string' ? (
                    <Typography.Caption color="text-subdued">
                      {headerDescription}
                    </Typography.Caption>
                  ) : (
                    headerDescription
                  )}
                </Box>
              )}
            </Box>
            {!!closeable && (
              <IconButton
                size="base"
                name="CloseSolid"
                type="plain"
                circle
                onPress={close}
              />
            )}
          </Box>
        )}
        {children}
        {isValidElement(footer) || footer === null ? (
          footer
        ) : (
          <Box borderTopWidth={1} borderTopColor="border-subdued">
            <HStack
              py="4"
              px="6"
              display="flex"
              flexDirection="row-reverse"
              alignItems="center"
              space="3"
            >
              {!hidePrimaryAction && (
                <Button
                  type="primary"
                  onPress={() => {
                    onPrimaryActionPress?.({ onClose, close });
                  }}
                  {...primaryActionProps}
                >
                  {intl.formatMessage({
                    id: primaryActionTranslationId ?? 'action__ok',
                  })}
                </Button>
              )}
              {!hideSecondaryAction && (
                <Button
                  onPress={() => {
                    onSecondaryActionPress?.({ close });
                    onClose?.();
                  }}
                  {...secondaryActionProps}
                >
                  {intl.formatMessage({
                    id: secondaryActionTranslationId ?? 'action__cancel',
                  })}
                </Button>
              )}
            </HStack>
          </Box>
        )}
      </Box>
    </Box>
  );
};

DesktopModal.displayName = 'DesktopModal';

export default DesktopModal;
