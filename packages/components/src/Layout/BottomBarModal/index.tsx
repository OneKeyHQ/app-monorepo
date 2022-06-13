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
    const [inactiveFontColor] = useThemeValue(['text-subdued']);
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
        <Box mb={props.tabBarHeight} p="16px">
          {props.foldableList.map((foldable) => (
            <Pressable
              key={foldable.name}
              onPress={foldable.onPress}
              _hover={{ bg: 'surface-hovered' }}
              borderRadius="xl"
              p="2"
            >
              <Box display="flex" flexDirection="column">
                <Box display="flex" flexDirection="row" alignItems="center">
                  <Icon
                    name={foldable?.tabBarIcon?.() as ICON_NAMES}
                    color="icon-default"
                    size={24}
                  />

                  <Typography.Body2Strong ml="3" color={inactiveFontColor}>
                    {foldable.tabBarLabel}
                  </Typography.Body2Strong>
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
