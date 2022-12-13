import { isValidElement } from 'react';

import Modal from 'react-native-modal';

import Box from '../../Box';
import Button from '../../Button';
import IconButton from '../../IconButton';
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
  onModalHide,
  activatable,
}: ChildProps<T>) {
  const { bottom } = useSafeAreaInsets();
  return (
    <Modal
      propagateSwipe
      hideModalContentWhileAnimating
      useNativeDriver
      useNativeDriverForBackdrop
      isVisible={!!visible}
      onModalHide={onModalHide}
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
        minW="full"
        bg="surface-subdued"
        borderTopRadius="24px"
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
        <ScrollView _contentContainerStyle={{ padding: 2, paddingBottom: '4' }}>
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
    </Modal>
  );
}

export default Mobile;
