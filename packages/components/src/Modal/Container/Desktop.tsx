import React, { FC, isValidElement } from 'react';

import { useIntl } from 'react-intl';
import Modal from 'react-native-modal';

import Box from '../../Box';
import Button from '../../Button';
import Divider from '../../Divider';
import Icon from '../../Icon';
import Pressable from '../../Pressable';
import Typography from '../../Typography';

import type { ModalProps } from '..';

const DesktopModal: FC<ModalProps> = ({
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
  return (
    <Modal
      useNativeDriver
      hideModalContentWhileAnimating
      isVisible={!!visible}
      animationIn="fadeIn"
      animationOut="fadeOut"
      onBackdropPress={closeable ? onClose : undefined}
    >
      <Box
        width="720px"
        alignSelf="center"
        borderRadius="24px"
        bg="surface-subdued"
      >
        <Box
          py="5"
          px="6"
          display="flex"
          flexDirection="row"
          justifyContent="space-between"
          alignItems="center"
        >
          <Typography.Heading flex="1">{header}</Typography.Heading>
          {!!closeable && (
            <Pressable onPress={onClose}>
              <Icon name="CloseOutline" size={20} />
            </Pressable>
          )}
        </Box>
        <Divider />
        <Box p="6" minHeight="70px">
          {children}
        </Box>
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
    </Modal>
  );
};

export default DesktopModal;
