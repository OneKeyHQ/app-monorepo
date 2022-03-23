/* eslint-disable @typescript-eslint/no-unsafe-call */
import React, { FC, isValidElement, useState } from 'react';

import {
  useFocusEffect,
  useNavigation,
  useNavigationState,
} from '@react-navigation/core';
import { useIntl } from 'react-intl';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import Box from '../../Box';
import Button from '../../Button';
import HStack from '../../HStack';
import IconButton from '../../IconButton';
import { useSafeAreaInsets } from '../../Provider/hooks';
import Typography from '../../Typography';

import useModalClose from './useModalClose';

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
  onBackActionPress,
  onPrimaryActionPress,
  onSecondaryActionPress,
  header,
  headerDescription,
  closeAction,
}) => {
  const intl = useIntl();
  const navigation = useNavigation();
  const { bottom, top } = useSafeAreaInsets();
  const index = useNavigationState((state) => state.index);
  const [currentStackIndex, setCurrentStackIndex] = useState(0);

  const close = useModalClose({ onClose });

  useFocusEffect(() => {
    setCurrentStackIndex(index);
  });

  return (
    <Box
      flex="1"
      bg="surface-subdued"
      pt={platformEnv.isAndroid ? `${top}px` : 0}
    >
      <Box
        pt={1}
        pr={2}
        pl={currentStackIndex ? 2 : '56px'}
        pb={header ? 1 : 0}
        display="flex"
        flexDirection="row"
        justifyContent="space-between"
        alignItems="center"
        borderBottomColor="border-subdued"
        borderBottomWidth={header ? 1 : undefined}
      >
        {currentStackIndex && navigation.canGoBack() ? (
          <IconButton
            size="xl"
            name="ChevronLeftOutline"
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
        <Box flex="1">
          <Typography.Heading textAlign="center">{header}</Typography.Heading>
          {!!headerDescription && (
            <Typography.Caption textAlign="center" color="text-subdued">
              {headerDescription}
            </Typography.Caption>
          )}
        </Box>
        <IconButton
          size="xl"
          name="CloseOutline"
          type="plain"
          circle
          onPress={closeAction || close}
        />
      </Box>
      {children}
      {isValidElement(footer) || footer === null ? (
        footer
      ) : (
        <Box pb={bottom} borderTopWidth={1} borderTopColor="border-subdued">
          <HStack
            p={4}
            display="flex"
            flexDirection="row-reverse"
            justifyContent="space-between"
            alignItems="center"
            space="4"
          >
            {!hidePrimaryAction && (
              <Button
                flex="1"
                size="xl"
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
                flex="1"
                size="xl"
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
  );
};

export default MobileModal;
