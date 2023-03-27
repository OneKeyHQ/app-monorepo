/* eslint-disable @typescript-eslint/no-unsafe-call */
import type { ComponentProps, FC } from 'react';
import { isValidElement, useMemo, useState } from 'react';

import {
  useFocusEffect,
  useNavigation,
  useNavigationState,
} from '@react-navigation/core';
import { useIntl } from 'react-intl';

import { VStack, useSafeAreaInsets } from '@onekeyhq/components';
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
  extraElement,
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
  enableMobileFooterWrap,
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

  const { FooterButtonContainer, btnProps } = useMemo(() => {
    const props: ComponentProps<typeof Button> = {
      size: platformEnv.isExtension ? 'lg' : 'xl',
    };
    Object.assign(props, enableMobileFooterWrap ? { w: 'full' } : { flex: 1 });
    return {
      btnProps: props,
      FooterButtonContainer: enableMobileFooterWrap ? VStack : HStack,
    };
  }, [enableMobileFooterWrap]);

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
          borderTopWidth={
            platformEnv.isNativeIOS || enableMobileFooterWrap ? 0 : 1
          }
          borderTopColor="divider"
        >
          {extraElement && (
            <Box alignSelf="center" p="16px" pb="0">
              {extraElement}
            </Box>
          )}
          <FooterButtonContainer p={4} alignItems="center" space="4">
            {!hideSecondaryAction && (
              <Button
                {...btnProps}
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
                {...btnProps}
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
          </FooterButtonContainer>
        </Box>
      )}
    </Box>
  );
};

export default MobileModal;
