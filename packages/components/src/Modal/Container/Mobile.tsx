/* eslint-disable @typescript-eslint/no-unsafe-call */
import type { FC } from 'react';
import { isValidElement, useState } from 'react';

import {
  useFocusEffect,
  useNavigation,
  useNavigationState,
} from '@react-navigation/core';
import { useIntl } from 'react-intl';

import { useSafeAreaInsets } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import Box from '../../Box';
import Button from '../../Button';
import HStack from '../../HStack';

import Header from './Header/Header';
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
  rightContent,
}) => {
  const intl = useIntl();
  const navigation = useNavigation();
  const { bottom, top } = useSafeAreaInsets();
  const index = useNavigationState((state) => state?.index);
  const [currentStackIndex, setCurrentStackIndex] = useState(0);

  const close = useModalClose({ onClose });

  useFocusEffect(() => {
    setCurrentStackIndex(index);
  });

  return (
    <Box
      testID="MobileModal-Container"
      flex="1"
      bg="background-default"
      pt={platformEnv.isNativeAndroid ? `${top}px` : 0}
    >
      {!!headerShown && (
        <Header
          header={header}
          headerDescription={headerDescription}
          firstIndex={!(currentStackIndex && navigation?.canGoBack?.())}
          hideBackButton={hideBackButton}
          onPressBackButton={() => {
            if (onBackActionPress) {
              onBackActionPress();
              return;
            }
            if (navigation?.canGoBack?.()) {
              navigation.goBack();
            }
          }}
          onPressCloseButton={closeAction || close}
          closeable
          rightContent={rightContent}
        />
      )}
      {children}
      {isValidElement(footer) || footer === null ? (
        footer
      ) : (
        <Box
          pb={`${bottom}px`}
          borderTopWidth={platformEnv.isNativeIOS ? 0 : 1}
          borderTopColor="divider"
        >
          <HStack p={4} alignItems="center" space="4">
            {!hideSecondaryAction && (
              <Button
                flex="1"
                size={platformEnv.isExtension ? 'lg' : 'xl'}
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
            {!hidePrimaryAction && (
              <Button
                flex="1"
                size={platformEnv.isExtension ? 'lg' : 'xl'}
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
          </HStack>
        </Box>
      )}
    </Box>
  );
};

export default MobileModal;
