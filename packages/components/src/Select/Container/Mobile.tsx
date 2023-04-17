import { isValidElement, useEffect, useMemo, useRef } from 'react';

import { Modalize } from 'react-native-modalize';

import { useSafeAreaInsets, useThemeValue } from '@onekeyhq/components';
import { FULLWINDOW_OVERLAY_PORTAL } from '@onekeyhq/kit/src/utils/overlayUtils';
import { PortalEntry } from '@onekeyhq/kit/src/views/Overlay/RootPortal';

import Box from '../../Box';
import Button from '../../Button';
import IconButton from '../../IconButton';
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
}: ChildProps<T>) {
  const { bottom, top } = useSafeAreaInsets();
  const modalizeRef = useRef<Modalize>(null);
  const [defaultBgColor, handleBgColor] = useThemeValue([
    'background-default',
    'icon-subdued',
  ]);

  useEffect(() => {
    if (visible) {
      setTimeout(() => modalizeRef.current?.open(), 10);
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
      adjustToContentHeight
      ref={modalizeRef}
      withHandle={false}
      onClose={onModalHide}
      modalTopOffset={top}
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
      tapGestureEnabled={false}
    >
      <Box
        // maxHeight="70%"
        minHeight="180px"
        minW="full"
        // bg="surface-subdued"
        borderTopRadius="24px"
        p={2}
        pb={4}
        // pb={`${footer === null ? bottom : 0}px`}
        {...dropdownProps}
      >
        <RenderOptions
          options={options}
          activeOption={activeOption}
          renderItem={renderItem}
          onChange={onChange}
          activatable={activatable}
        />
      </Box>
    </Modalize>
  );

  return (
    <PortalEntry target={FULLWINDOW_OVERLAY_PORTAL}>{content}</PortalEntry>
  );
}

export default Mobile;
