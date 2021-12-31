/* eslint-disable @typescript-eslint/no-unsafe-call */
import React, { FC, isValidElement } from 'react';

import { useNavigation, useNavigationState } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import Box from '../../Box';
import Button from '../../Button';
import Divider from '../../Divider';
import Icon from '../../Icon';
import Pressable from '../../Pressable';
import { useSafeAreaInsets } from '../../Provider/hooks';
import Typography from '../../Typography';

import type { ModalProps } from '..';

const MobileModal: FC<ModalProps> = ({
  children,
  onClose,
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
  const navigation = useNavigation();
  const { bottom } = useSafeAreaInsets();
  const index = useNavigationState((state) => state.index);

  return (
    <Box flex="1" bg="background-default">
      <Box
        px="6"
        p="5"
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
        <Pressable
          onPress={() => {
            // @ts-expect-error
            navigation?.popToTop?.();
            navigation.goBack();
          }}
        >
          <Icon name="CloseOutline" size={24} />
        </Pressable>
      </Box>
      <Divider />
      {children}
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
  );
};

export default MobileModal;
