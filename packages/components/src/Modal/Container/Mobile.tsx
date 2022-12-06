/* eslint-disable @typescript-eslint/no-unsafe-call */
import { FC, isValidElement, useMemo, useState } from 'react';

import {
  useFocusEffect,
  useNavigation,
  useNavigationState,
  useRoute,
} from '@react-navigation/core';
import { useIntl } from 'react-intl';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import Box from '../../Box';
import Button from '../../Button';
import HStack from '../../HStack';
import IconButton from '../../IconButton';
import Pressable from '../../Pressable';
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
  headerShown,
  headerDescription,
  closeAction,
  hideBackButton,
}) => {
  const intl = useIntl();
  const navigation = useNavigation();
  const { bottom, top } = useSafeAreaInsets();
  const index = useNavigationState((state) => state?.index);
  const [currentStackIndex, setCurrentStackIndex] = useState(0);

  const route = useRoute();
  const close = useModalClose({ onClose });

  useFocusEffect(() => {
    setCurrentStackIndex(index);
  });

  const headerTitleView = useMemo(
    () => <Typography.Heading textAlign="center">{header}</Typography.Heading>,
    [header],
  );
  return (
    <Box
      testID="MobileModal-Container"
      flex="1"
      bg="surface-subdued"
      pt={platformEnv.isNativeAndroid ? `${top}px` : 0}
    >
      {!!headerShown && (
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
          {currentStackIndex && navigation?.canGoBack?.() ? (
            <IconButton
              size="xl"
              name="ChevronLeftOutline"
              type="plain"
              opacity={hideBackButton ? 0 : 1}
              circle
              onPress={() => {
                if (hideBackButton) {
                  return;
                }
                if (onBackActionPress) {
                  onBackActionPress();
                  return;
                }
                if (navigation?.canGoBack?.()) {
                  navigation.goBack();
                }
              }}
            />
          ) : null}
          <Box flex="1">
            {platformEnv.isDev ? (
              <Pressable
                onPress={() => {
                  console.log('Modal route params:', route.params, route.name);
                }}
              >
                {headerTitleView}
              </Pressable>
            ) : (
              headerTitleView
            )}
            {!!headerDescription && (
              <Box alignItems="center">
                {typeof headerDescription === 'string' ? (
                  <Typography.Caption textAlign="center" color="text-subdued">
                    {headerDescription}
                  </Typography.Caption>
                ) : (
                  headerDescription
                )}
              </Box>
            )}
          </Box>
          <IconButton
            size="xl"
            name="XMarkOutline"
            type="plain"
            circle
            onPress={closeAction || close}
          />
        </Box>
      )}
      {children}
      {isValidElement(footer) || footer === null ? (
        footer
      ) : (
        <Box
          pb={`${bottom}px`}
          borderTopWidth={1}
          borderTopColor="border-subdued"
        >
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
                {primaryActionProps?.children ??
                  intl.formatMessage({
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
                {secondaryActionProps?.children ??
                  intl.formatMessage({
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
