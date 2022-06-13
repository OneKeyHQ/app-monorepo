/* eslint-disable react/prop-types */
import {
  ForwardedRef,
  MutableRefObject,
  forwardRef,
  useEffect,
  useRef,
} from 'react';

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
    const [inactiveFontColor] = useThemeValue(['text-default']);
    return (
      <Modalize
        adjustToContentHeight
        ref={combinedRef}
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
      >
        <Box mb={props.tabBarHeight} p="16px" bgColor="background-default">
          {props.foldableList.map((foldable, index) => (
            <Pressable
              key={index}
              onPress={foldable.onPress}
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
      </Modalize>
    );
  },
);

BottomBarModal.displayName = 'BottomBarModal';

export default BottomBarModal;
