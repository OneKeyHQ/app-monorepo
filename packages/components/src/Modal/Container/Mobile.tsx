import React, { FC, isValidElement } from 'react';

import { useIntl } from 'react-intl';
import { StatusBar } from 'react-native';
import Modal from 'react-native-modal';

import Box from '../../Box';
import Button from '../../Button';
import Divider from '../../Divider';
import Icon from '../../Icon';
import Pressable from '../../Pressable';
import { useSafeAreaInsets } from '../../Provider/hooks';
import Typography from '../../Typography';

import type { ModalProps } from '..';

const MobileModal: FC<ModalProps> = ({
  visible,
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
}) => {
  const intl = useIntl();
  const { bottom, top } = useSafeAreaInsets();
  const DEFAULT_HEADER_TOP_PADDING = 20;
  const headerTopPadding = StatusBar.currentHeight
    ? DEFAULT_HEADER_TOP_PADDING
    : DEFAULT_HEADER_TOP_PADDING + top;
  return (
    <Modal
      useNativeDriver
      propagateSwipe
      hideModalContentWhileAnimating
      isVisible={!!visible}
      swipeDirection={['down']}
      onSwipeComplete={onClose}
      onBackdropPress={onClose}
      animationInTiming={150}
      animationOutTiming={150}
      animationIn="slideInUp"
      animationOut="slideOutDown"
      style={{
        justifyContent: 'flex-end',
        margin: 0,
      }}
    >
      <Box flex="1" bg="surface-subdued">
        <Box
          px="6"
          py="5"
          pt={`${headerTopPadding}px`}
          display="flex"
          flexDirection="row"
          justifyContent="space-between"
          alignItems="center"
        >
          <Typography.Heading flex="1" textAlign="center">
            {header}
          </Typography.Heading>
          {!!closeable && (
            <Pressable onPress={onClose}>
              <Icon name="CloseOutline" size={20} />
            </Pressable>
          )}
        </Box>
        <Divider />
        <Box p="6" flex="1">
          {children}
        </Box>
        {isValidElement(footer) || footer === null ? (
          footer
        ) : (
          <Box height={70 + bottom}>
            <Divider />
            <Box
              py="4"
              px="6"
              display="flex"
              flexDirection="row-reverse"
              justifyContent="space-between"
              alignItems="center"
            >
              {!hidePrimaryAction && (
                <Button
                  flex="1"
                  type="primary"
                  ml="3"
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
                  flex="1"
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
    </Modal>
  );
};

export default MobileModal;
