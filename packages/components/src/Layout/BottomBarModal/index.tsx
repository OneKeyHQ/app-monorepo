/* eslint-disable react/prop-types */
import { forwardRef, useCallback } from 'react';

import BottomSheet, { BottomSheetBackdrop } from '@gorhom/bottom-sheet';

import Box from '../../Box';
import Icon from '../../Icon';
import Pressable from '../../Pressable';
import { useThemeValue } from '../../Provider/hooks';
import Typography from '../../Typography';

import type { ICON_NAMES } from '../../Icon/Icons';
import type { TBottomBarModalProps } from '../BottomTabs/types';

const BottomBarModal = forwardRef<BottomSheet, TBottomBarModalProps>(
  ({ onOpen, onClose, ...props }, ref) => {
    const [inactiveFontColor, sheetBgColor] = useThemeValue([
      'text-default',
      'background-default',
    ]);

    const handleSheetChanges = useCallback(
      (from: number) => {
        setTimeout(() => {
          if (from < 0) {
            onOpen();
          } else {
            onClose();
          }
        });
      },
      [onClose, onOpen],
    );

    const renderBackdrop = useCallback(
      (backdropComponentProps) => (
        <BottomSheetBackdrop
          {...backdropComponentProps}
          disappearsOnIndex={-1}
          appearsOnIndex={0}
        />
      ),
      [],
    );

    const ITEM_COUNT = 2;
    const innerHeight = 60 * ITEM_COUNT + 32 * 2;
    return (
      <BottomSheet
        ref={ref}
        index={-1}
        snapPoints={['2%', innerHeight]}
        onAnimate={handleSheetChanges}
        onChange={(index) => handleSheetChanges(-index)}
        bottomInset={props.tabBarHeight}
        enablePanDownToClose
        handleComponent={null}
        backdropComponent={renderBackdrop}
        backgroundStyle={{ backgroundColor: sheetBgColor }}
      >
        <Box px={4} py={8}>
          {props.foldableList.map((foldable, index) => (
            <Pressable
              key={index}
              onPress={() => {
                foldable.onPress();
                props.handleClose();
              }}
              _hover={{ bg: 'surface-hovered' }}
              _pressed={{ bg: 'surface-pressed' }}
              borderRadius="xl"
              mt={index === 0 ? undefined : 2}
              p="2"
            >
              <Box display="flex" flexDirection="column">
                <Box display="flex" flexDirection="row" alignItems="flex-start">
                  <Icon
                    name={foldable?.tabBarIcon?.() as ICON_NAMES}
                    color="icon-default"
                    size={24}
                  />

                  <Box ml={4}>
                    <Typography.Body1Strong color={inactiveFontColor}>
                      {foldable.tabBarLabel}
                    </Typography.Body1Strong>
                    <Typography.Body2 color="text-subdued">
                      {foldable.description}
                    </Typography.Body2>
                  </Box>
                </Box>
              </Box>
            </Pressable>
          ))}
        </Box>
      </BottomSheet>
    );
  },
);

BottomBarModal.displayName = 'BottomBarModal';

export default BottomBarModal;
