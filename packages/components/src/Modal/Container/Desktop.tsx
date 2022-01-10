/* eslint-disable @typescript-eslint/no-unsafe-call */
import React, { FC, isValidElement } from 'react';

import { useNavigation, useNavigationState } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import Box from '../../Box';
import Button from '../../Button';
import IconButton from '../../IconButton';
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
  height,
  headerDescription,
}) => {
  const intl = useIntl();
  const navigation = useNavigation();
  const index = useNavigationState((state) => state.index);

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
        height={height}
        alignSelf="center"
        borderRadius="24px"
        bg="surface-subdued"
        zIndex={999}
      >
        <Box
          p={4}
          pl={index ? 4 : 6}
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
                if (navigation.canGoBack()) {
                  navigation.goBack();
                }
              }}
            />
          ) : null}
          <Box flex="1" ml={index ? 4 : undefined}>
            <Typography.Heading>{header}</Typography.Heading>
            {!!headerDescription && (
              <Typography.Caption color="text-subdued">
                {headerDescription}
              </Typography.Caption>
            )}
          </Box>
          {!!closeable && (
            <IconButton
              size="base"
              name="CloseSolid"
              type="plain"
              circle
              onPress={() => {
                // @ts-expect-error
                navigation?.popToTop?.();
                navigation.goBack();
              }}
            />
          )}
        </Box>
        {children}
        {isValidElement(footer) || footer === null ? (
          footer
        ) : (
          <Box borderTopWidth={1} borderTopColor="border-subdued">
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
