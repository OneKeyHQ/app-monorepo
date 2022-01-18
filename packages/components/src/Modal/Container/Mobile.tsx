/* eslint-disable @typescript-eslint/no-unsafe-call */
import React, { FC, isValidElement } from 'react';

import { useNavigation, useNavigationState } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import Box from '../../Box';
import Button from '../../Button';
import HStack from '../../HStack';
import IconButton from '../../IconButton';
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
  headerDescription,
}) => {
  const intl = useIntl();
  const navigation = useNavigation();
  const { bottom } = useSafeAreaInsets();
  const index = useNavigationState((state) => state.index);

  return (
    <Box flex="1" bg="surface-subdued">
      <Box
        py={1}
        pr={2}
        pl={index ? 2 : '56px'}
        display="flex"
        flexDirection="row"
        justifyContent="space-between"
        alignItems="center"
        borderBottomColor="border-subdued"
        borderBottomWidth={header ? 1 : undefined}
      >
        {index ? (
          <IconButton
            size="xl"
            name="ChevronLeftOutline"
            type="plain"
            circle
            onPress={() => {
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
          onPress={() => {
            navigation.getParent()?.goBack?.();
          }}
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
                size="lg"
                type="primary"
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
                size="lg"
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
          </HStack>
        </Box>
      )}
    </Box>
  );
};

export default MobileModal;
