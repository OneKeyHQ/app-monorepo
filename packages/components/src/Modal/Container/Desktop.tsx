/* eslint-disable @typescript-eslint/no-unsafe-call */
import React, { FC, isValidElement } from 'react';

import { useNavigation, useNavigationState } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import Box from '../../Box';
import Button from '../../Button';
import Divider from '../../Divider';
import Icon from '../../Icon';
import Pressable from '../../Pressable';
import Typography from '../../Typography';

import type { ModalProps } from '..';

const DesktopModal: FC<ModalProps> = ({
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
  onPrimaryActionPress,
  onSecondaryActionPress,
  header,
  size,
}) => {
  const intl = useIntl();
  const navigation = useNavigation();
  const index = useNavigationState((state) => state.index);

  function modalSizing(modalSize: string | undefined) {
    if (modalSize === 'xs') {
      return '400px';
    }
    if (modalSize === 'sm') {
      return '480px';
    }
    if (modalSize === 'md') {
      return '560px';
    }
    if (modalSize === 'lg') {
      return '640px';
    }
    if (modalSize === 'xl') {
      return '720px';
    }
    if (modalSize === '2xl') {
      return '800px';
    }
  }

  return (
    <Box
      position="absolute"
      top="0"
      left="0"
      right="0"
      bottom="0"
      justifyContent="center"
      alignItems="center"
      zIndex={99}
    >
      <Box
        width={modalSizing(size)}
        alignSelf="center"
        borderRadius="24px"
        bg="surface-subdued"
        height="548px"
        zIndex={999}
      >
        <Box
          py="5"
          px="6"
          display="flex"
          flexDirection="row"
          justifyContent="space-between"
          alignItems="center"
        >
          {index ? (
            <Pressable
              onPress={() => {
                if (navigation.canGoBack()) {
                  navigation.goBack();
                }
              }}
            >
              <Icon name="ChevronLeftOutline" size={24} />
            </Pressable>
          ) : null}
          <Typography.Heading flex="1" textAlign="center">
            {header}
          </Typography.Heading>
          {!!closeable && (
            <Pressable
              onPress={() => {
                // @ts-expect-error
                navigation?.popToTop?.();
                navigation.goBack();
              }}
            >
              <Icon name="CloseOutline" size={20} />
            </Pressable>
          )}
        </Box>
        <Divider />
        {children}
        {isValidElement(footer) || footer === null ? (
          footer
        ) : (
          <Box height="70px">
            <Divider />
            <Box
              py="4"
              px="6"
              display="flex"
              flexDirection="row-reverse"
              alignItems="center"
            >
              {!hidePrimaryAction && (
                <Button
                  type="primary"
                  ml="3"
                  minW="120px"
                  onPress={() => {
                    onPrimaryActionPress?.({ onClose });
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
                  minW="120px"
                  onPress={() => {
                    onSecondaryActionPress?.();
                    onClose?.();
                  }}
                  {...secondaryActionProps}
                >
                  {intl.formatMessage({
                    id: secondaryActionTranslationId ?? 'action__cancel',
                  })}
                </Button>
              )}
            </Box>
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default DesktopModal;
