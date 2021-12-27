import React, { isValidElement } from 'react';

import Modal from 'react-native-modal';

import Box from '../../Box';
import Divider from '../../Divider';
import Icon from '../../Icon';
import Pressable from '../../Pressable';
import { useSafeAreaInsets } from '../../Provider/hooks';
import ScrollView from '../../ScrollView';
import Typography from '../../Typography';

import { renderOptions } from './Option';

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
}: ChildProps<T>) {
  const { bottom } = useSafeAreaInsets();
  return (
    <Modal
      useNativeDriver
      propagateSwipe
      hideModalContentWhileAnimating
      isVisible={!!visible}
      swipeDirection={['down']}
      onSwipeComplete={toggleVisible}
      onBackdropPress={toggleVisible}
      animationInTiming={150}
      animationOutTiming={150}
      animationIn="slideInUp"
      animationOut="slideOutDown"
      style={{
        justifyContent: 'flex-end',
        margin: 0,
      }}
    >
      <Box
        maxHeight="70%"
        minHeight="180px"
        bg="surface-subdued"
        borderTopRadius="24px"
        {...dropdownProps}
      >
        <Box
          p="4"
          display="flex"
          flexDirection="row"
          justifyContent="space-between"
          alignItems="center"
        >
          <Typography.Heading>{title}</Typography.Heading>
          <Pressable onPress={toggleVisible}>
            <Icon name="CloseOutline" size={16} />
          </Pressable>
        </Box>
        <Divider />
        <ScrollView _contentContainerStyle={{ padding: 2, paddingBottom: '4' }}>
          {renderOptions<T>({ options, activeOption, renderItem, onChange })}
        </ScrollView>
        {isValidElement(footer) || footer === null ? (
          footer
        ) : (
          <Box pb={`${bottom}px`}>
            <Divider />
            <Pressable
              p="3"
              display="flex"
              flexDirection="row"
              justifyContent="center"
              alignItems="center"
              onPress={onPressFooter}
            >
              {footerIcon ? <Icon name={footerIcon} size={12} /> : null}
              <Typography.Body2 mx="2">{footerText}</Typography.Body2>
            </Pressable>
          </Box>
        )}
      </Box>
    </Modal>
  );
}

export default Mobile;
