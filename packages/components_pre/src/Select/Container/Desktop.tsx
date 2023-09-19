import { isValidElement, useRef } from 'react';

import Box from '../../Box';
import Button from '../../Button';
import { useDropdownPosition } from '../../hooks/useDropdownPosition';
import IconButton from '../../IconButton';
import PresenceTransition from '../../PresenceTransition';
import ScrollView from '../../ScrollView';
import Typography from '../../Typography';

import { RenderOptions } from './Option';

import type { ChildProps } from '..';

type DesktopRef = {
  domId: string;
  getVisible: () => boolean;
  toggleVisible: () => void;
};
/* eslint-disable react/prop-types,react/display-name */
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
  autoAdjustPosition,
  outerContainerRef,
}: ChildProps<T>) {
  const translateY = positionTranslateY;

  const contentRef = useRef();
  const { position, triggerWidth, toPxPositionValue, isPositionNotReady } =
    useDropdownPosition({
      contentRef,
      triggerEle,
      visible,
      dropdownPosition,
      translateY,
      setPositionOnlyMounted,
      dropdownProps,
      autoAdjust: autoAdjustPosition,
      outerContainerRef,
    });

  const content = (
    <PresenceTransition
      visible={visible && !isPositionNotReady}
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
        ref={contentRef}
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
              name="XMarkMini"
              type="plain"
              size="xs"
              onPress={toggleVisible}
              circle
            />
          </Box>
        ) : null}
        <ScrollView p="1" flex="1">
          <RenderOptions
            options={options}
            activeOption={activeOption}
            renderItem={renderItem}
            onChange={onChange}
            activatable={activatable}
          />
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
  return content;
}
/* eslint-disable react/prop-types,react/display-name */
Desktop.displayName = 'Desktop';

export default Desktop;

export type { DesktopRef };
