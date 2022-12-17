/* eslint-disable react/prop-types */
import type { ForwardedRef, MutableRefObject } from 'react';
import { forwardRef, useEffect, useRef } from 'react';

import { Modalize } from 'react-native-modalize';

import Box from '../../Box';
import Icon from '../../Icon';
import Pressable from '../../Pressable';
import { useThemeValue } from '../../Provider/hooks';
import Typography from '../../Typography';

import type { ICON_NAMES } from '../../Icon/Icons';
import type {
  TBottomBarModalProps,
  TBottomBarRefAttr,
} from '../BottomTabs/types';

export const useCombinedRefs = (
  ...refs: (
    | ForwardedRef<any>
    | ((c: MutableRefObject<any>['current']) => void)
  )[]
) => {
  const targetRef = useRef();

  useEffect(() => {
    refs.forEach((ref) => {
      if (!ref) {
        return;
      }

      if (typeof ref === 'function') {
        ref(targetRef.current);
      } else {
        ref.current = targetRef.current;
      }
    });
  }, [refs]);

  return targetRef;
};

const BottomBarModal = forwardRef<TBottomBarRefAttr, TBottomBarModalProps>(
  (props, ref) => {
    const modalizeRef = useRef(null);
    const combinedRef = useCombinedRefs(ref, modalizeRef);
    const [defaultBgColor, handleBgColor] = useThemeValue([
      'background-default',
      'icon-subdued',
    ]);
    return (
      <Modalize
        adjustToContentHeight
        ref={combinedRef}
        withHandle={false}
        onClose={props.onClose}
        onOpen={props.onOpen}
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
      >
        <Box mb={props.tabBarHeight} px={4} pt={8} pb={16}>
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
      </Modalize>
    );
  },
);

BottomBarModal.displayName = 'BottomBarModal';

export default BottomBarModal;
