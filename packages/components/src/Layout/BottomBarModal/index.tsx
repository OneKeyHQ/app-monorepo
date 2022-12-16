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
    const [sheetBgColor] = useThemeValue(['background-default']);

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

    const ITEM_COUNT = 4;
    const innerHeight = 72 * ITEM_COUNT + 32 + 56;
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
        <Box px={4} pt={8} pb={16}>
          {props.foldableList.map((foldable, index) => (
            <Pressable
              key={index}
              disabled={foldable.disabled}
              onPress={() => {
                foldable.onPress();
                props.handleClose();
              }}
              _hover={{ bg: 'surface-hovered' }}
              _pressed={{ bg: 'surface-pressed' }}
              borderRadius="xl"
              mt={index === 0 ? undefined : 2}
              px="2"
              py="3"
            >
              <Box display="flex" flexDirection="column">
                <Box display="flex" flexDirection="row" alignItems="center">
                  <Box
                    p={3}
                    rounded="full"
                    bg={
                      foldable.disabled
                        ? 'surface-neutral-subdued'
                        : 'interactive-default'
                    }
                  >
                    <Icon
                      name={foldable?.tabBarIcon?.() as ICON_NAMES}
                      color={
                        foldable.disabled ? 'icon-disabled' : 'icon-on-primary'
                      }
                      size={20}
                    />
                  </Box>

                  <Box ml={4}>
                    <Typography.Heading
                      color={
                        foldable.disabled ? 'text-disabled' : 'text-default'
                      }
                    >
                      {foldable.tabBarLabel}
                    </Typography.Heading>
                    <Typography.Body2
                      color={
                        foldable.disabled ? 'text-disabled' : 'text-subdued'
                      }
                    >
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
