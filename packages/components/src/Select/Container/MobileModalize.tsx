import { isValidElement, useEffect, useMemo, useRef } from 'react';

import { Animated } from 'react-native';
import { Modalize } from 'react-native-modalize';
import { RootSiblingPortal } from 'react-native-root-siblings';

import { useSafeAreaInsets, useThemeValue } from '@onekeyhq/components';

import Box from '../../Box';
import Button from '../../Button';
import IconButton from '../../IconButton';
import ScrollView from '../../ScrollView';
import Typography from '../../Typography';

import { RenderOptions } from './Option';

import type { ChildProps } from '..';

function Mobile<T>({
  dropdownProps,
  toggleVisible,
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
          name="XMarkOutline"
          type="plain"
          size="xl"
          onPress={toggleVisible}
          circle
        />
      </Box>
    ),
    [title, toggleVisible],
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
      modalTopOffset={300}
      withReactModal={withReactModal}
      panGestureAnimatedValue={animated}
      adjustToContentHeight
      ref={modalizeRef}
      snapPoint={480}
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
        // default styles start
        alignSelf: 'center',
        top: 8,
        width: 45,
        height: 5,
        borderRadius: 5,
        // default styles end

        // custom styles
        backgroundColor: handleBgColor,
      }}
      HeaderComponent={headerComponent}
      FooterComponent={footerComponent}
    >
      <Box
        // maxHeight="70%"
        minHeight="180px"
        minW="full"
        // bg="surface-subdued"
        borderTopRadius="24px"
        pb="0px"
        // pb={`${footer === null ? bottom : 0}px`}
        {...dropdownProps}
      >
        <ScrollView _contentContainerStyle={{ padding: 2, paddingBottom: '4' }}>
          <RenderOptions
            options={options}
            activeOption={activeOption}
            renderItem={renderItem}
            onChange={onChange}
            activatable={activatable}
          />
        </ScrollView>
      </Box>
    </Modalize>
  );

  if (withReactModal) {
    return content;
  }

  return <RootSiblingPortal>{content}</RootSiblingPortal>;
}

export default Mobile;
