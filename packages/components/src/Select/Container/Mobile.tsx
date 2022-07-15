import React, { isValidElement, useEffect, useMemo, useRef } from 'react';

import { Animated } from 'react-native';
import { Modalize } from 'react-native-modalize';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import Box from '../../Box';
import Button from '../../Button';
import IconButton from '../../IconButton';
import { OverlayContainer } from '../../OverlayContainer';
import { useSafeAreaInsets, useThemeValue } from '../../Provider/hooks';
import Typography from '../../Typography';

import { renderOptions } from './Option';

import type { ChildProps } from '..';

function Mobile<T>({
  options,
  onChange,
  visible,
  title,
  footer,
  footerText,
  footerIcon,
  onPressFooter,
  activeOption,
  renderItem,
  onModalHide,
  activatable,
  withReactModal,
}: ChildProps<T>) {
  const { bottom } = useSafeAreaInsets();
  const modalizeRef = useRef<Modalize>(null);
  const animated = useRef(new Animated.Value(0)).current;
  const [defaultBgColor, handleBgColor] = useThemeValue([
    'background-default',
    'icon-subdued',
  ]);

  useEffect(() => {
    if (visible) {
      modalizeRef.current?.open();
    } else {
      onModalHide?.();
      modalizeRef.current?.close();
    }
  }, [visible, onModalHide]);

  const headerComponent = useMemo(
    () => (
      <Box
        py="1"
        px="2"
        display="flex"
        flexDirection="row"
        justifyContent="space-between"
        alignItems="center"
        bg="transparent"
      >
        {/* placeholder */}
        <Box width="12" />
        <Box flex="1" flexDirection="row" justifyContent="center">
          <Typography.Heading numberOfLines={1}>{title}</Typography.Heading>
        </Box>
        <IconButton
          name="CloseOutline"
          type="plain"
          size="xl"
          onPress={onModalHide}
          circle
        />
      </Box>
    ),
    [title, onModalHide],
  );

  const footerComponent = useMemo(
    () =>
      isValidElement(footer) || footer === null ? (
        footer
      ) : (
        <Box pb={`${bottom}px`} bg="surface-subdued">
          <Box px="4" py="2" borderTopWidth={1} borderTopColor="border-subdued">
            <Button
              size="xl"
              type="plain"
              leftIconName={footerIcon}
              onPress={onPressFooter}
            >
              {footerText}
            </Button>
          </Box>
        </Box>
      ),
    [bottom, footer, footerIcon, footerText, onPressFooter],
  );

  const content = (
    <Modalize
      adjustToContentHeight
      panGestureComponentEnabled
      modalTopOffset={300}
      withReactModal={withReactModal && platformEnv.isNativeIOS}
      panGestureAnimatedValue={animated}
      ref={modalizeRef}
      withHandle={false}
      onClose={onModalHide}
      openAnimationConfig={{
        timing: {
          duration: 150,
        },
      }}
      closeAnimationConfig={{
        timing: {
          duration: 150,
        },
      }}
      modalStyle={{
        backgroundColor: defaultBgColor,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
      }}
      handlePosition="inside"
      handleStyle={{
        alignSelf: 'center',
        top: 8,
        width: 45,
        height: 5,
        borderRadius: 5,
        backgroundColor: handleBgColor,
      }}
      HeaderComponent={headerComponent}
      FooterComponent={footerComponent}
      childrenStyle={{
        minWidth: '100%',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingBottom: 0,
      }}
      scrollViewProps={{
        contentContainerStyle: { padding: 2, paddingBottom: 4 },
      }}
    >
      {renderOptions<T>({
        options,
        activeOption,
        renderItem,
        onChange,
        activatable,
      })}
    </Modalize>
  );

  if (withReactModal && platformEnv.isNativeIOS) {
    return content;
  }

  return <OverlayContainer>{content}</OverlayContainer>;
}

export default Mobile;
