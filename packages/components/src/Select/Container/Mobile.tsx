import React, { isValidElement } from 'react';

// import Modal from 'react-native-modal';

import Box from '../../Box';
import Button from '../../Button';
import IconButton from '../../IconButton';
import { useSafeAreaInsets } from '../../Provider/hooks';
import RBSheet from '../../RBSheet';
import ScrollView from '../../ScrollView';
import Typography from '../../Typography';

import { renderOptions } from './Option';

import type { ChildProps } from '..';
import type { RBSheetRef } from '../../RBSheet';

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
  const { bottom } = useSafeAreaInsets();
  const rBsheetRef = React.useRef<RBSheetRef>(null);
  React.useEffect(() => {
    // console.log('visible change to ', visible);
    if (visible) {
      rBsheetRef.current?.open();
    } else {
      rBsheetRef.current?.close();
    }
  }, [visible]);

  let height = 60 * options.length;
  height = height > 500 ? 500 : height;
  // console.log('height', height);

  return (
    // <Modal
    //   propagateSwipe
    //   hideModalContentWhileAnimating
    //   useNativeDriver
    //   useNativeDriverForBackdrop
    //   isVisible={!!visible}
    //   onModalHide={onModalHide}
    //   swipeDirection={['down']}
    //   onSwipeComplete={toggleVisible}
    //   onBackdropPress={toggleVisible}
    //   animationInTiming={150}
    //   animationOutTiming={150}
    //   animationIn="slideInUp"
    //   animationOut="slideOutDown"
    //   style={{
    //     justifyContent: 'flex-end',
    //     margin: 0,
    //   }}
    // >
    <RBSheet
      ref={rBsheetRef}
      onModalHide={onModalHide}
      toggleVisible={toggleVisible}
    >
      <Box
        minW="full"
        bg="surface-subdued"
        pb={`${footer === null ? bottom : 0}px`}
        {...dropdownProps}
      >
        <Box
          py="1"
          px="2"
          display="flex"
          flexDirection="row"
          justifyContent="space-between"
          alignItems="center"
          borderBottomColor="border-subdued"
          borderBottomWidth={title ? 1 : undefined}
        >
          {/* placeholder */}
          <Box width="12" />
          <Typography.Heading>{title}</Typography.Heading>
          <IconButton
            name="CloseOutline"
            type="plain"
            size="xl"
            onPress={toggleVisible}
            circle
          />
        </Box>
        <ScrollView
          height={height}
          _contentContainerStyle={{ padding: 2, paddingBottom: 4 }}
        >
          {renderOptions<T>({
            options,
            activeOption,
            renderItem,
            onChange,
            activatable,
          })}
        </ScrollView>
        {isValidElement(footer) || footer === null ? (
          footer
        ) : (
          <Box pb={`${bottom}px`}>
            <Box
              px="4"
              py="2"
              borderTopWidth={1}
              borderTopColor="border-subdued"
            >
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
        )}
      </Box>
    </RBSheet>
    // </Modal>
  );
}

export default Mobile;
