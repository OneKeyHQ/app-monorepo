import React, { FC, isValidElement } from 'react';

import { useIntl } from 'react-intl';
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
  const { bottom } = useSafeAreaInsets();
  return (
    <Modal
      useNativeDriver
      propagateSwipe
      hideModalContentWhileAnimating
      isVisible={!!visible}
      swipeDirection={['down']}
      onSwipeComplete={onClose}
      onBackdropPress={onClose}
      animationIn="slideInUp"
      animationOut="slideOutDown"
      style={{
        justifyContent: 'flex-end',
        margin: 0,
      }}
    >
      <Box height="85%" borderTopRadius="24px" bg="surface-subdued">
        <Box
          py="5"
          px="6"
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
        {isValidElement(footer) ? (
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
                    id:
                      primaryActionTranslationId ??
                      'ui-components__modal__ok_text',
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
                    id:
                      secondaryActionTranslationId ??
                      'ui-components__modal__cancel_text',
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
