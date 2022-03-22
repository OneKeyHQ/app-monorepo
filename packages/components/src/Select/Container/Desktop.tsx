import React, { Fragment, isValidElement } from 'react';

import Box from '../../Box';
import Button from '../../Button';
import useClickDocumentClose from '../../hooks/useClickDocumentClose';
import { useDropdownPosition } from '../../hooks/useDropdownPosition';
import IconButton from '../../IconButton';
import { OverlayContainer } from '../../OverlayContainer';
import PresenceTransition from '../../PresenceTransition';
import ScrollView from '../../ScrollView';
import Typography from '../../Typography';

import { renderOptions } from './Option';

import type { ChildProps } from '..';

function Desktop<T>({
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
  headerShown,
  dropdownPosition,
  activatable,
  triggerEle,
  setPositionOnlyMounted,
  positionTranslateY = 2,
}: ChildProps<T>) {
  const translateY = positionTranslateY;

  const { domId } = useClickDocumentClose({
    name: 'SelectDesktop',
    visible,
    toggleVisible,
  });
  const { position, toPxPositionValue, triggerWidth } = useDropdownPosition({
    triggerEle,
    domId,
    visible,
    dropdownPosition,
    translateY,
    setPositionOnlyMounted,
    dropdownProps,
  });

  const content = (
    <PresenceTransition
      visible={visible}
      initial={{ opacity: 0, translateY: 0 }}
      animate={{
        opacity: 1,
        translateY,
        transition: {
          duration: 150,
        },
      }}
    >
      <Box
        nativeID={domId}
        position="absolute"
        width={triggerWidth ? toPxPositionValue(triggerWidth) : 'full'}
        left={toPxPositionValue(position.left)}
        right={toPxPositionValue(position.right)}
        top={toPxPositionValue(position.top)}
        bottom={toPxPositionValue(position.bottom)}
        maxHeight="480px"
        borderRadius="12"
        bg="surface-subdued"
        borderColor="border-subdued"
        borderWidth="1px"
        shadow="depth.3"
        {...dropdownProps}
      >
        {headerShown ? (
          <>
            <Box
              p="2"
              pl="3"
              display="flex"
              flexDirection="row"
              justifyContent="space-between"
              alignItems="center"
              borderBottomWidth={title ? 1 : undefined}
              borderBottomColor="border-subdued"
            >
              <Typography.Body2Strong>{title}</Typography.Body2Strong>
              <IconButton
                name="CloseSolid"
                type="plain"
                size="xs"
                onPress={toggleVisible}
                circle
              />
            </Box>
          </>
        ) : null}
        <ScrollView p="1" flex="1">
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
          <Box p="1.5" borderTopWidth={1} borderTopColor="border-subdued">
            <Button
              size="sm"
              type="plain"
              leftIconName={footerIcon}
              onPress={onPressFooter}
            >
              {footerText}
            </Button>
          </Box>
        )}
      </Box>
    </PresenceTransition>
  );
  // return content
  return <OverlayContainer>{content}</OverlayContainer>;
}

export default Desktop;
