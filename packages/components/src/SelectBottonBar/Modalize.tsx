import React, {
  FC,
  ForwardedRef,
  MutableRefObject,
  forwardRef,
  useEffect,
  useRef,
} from 'react';

import { Modalize } from 'react-native-modalize';

import {
  TBottomBarModalProps,
  TBottomBarRefAttr,
} from '../Layout/BottomTabs/types';
import { useThemeValue } from '../Provider/hooks';

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

const BottomBarModal = forwardRef<
  TBottomBarRefAttr,
  Omit<TBottomBarModalProps, 'foldableList' | 'tabBarHeight'> & {
    children: React.ReactNode;
  }
  // eslint-disable-next-line react/prop-types
>(({ onOpen, onClose, children }, ref) => {
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
      onClose={onClose}
      onOpen={onOpen}
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
      {children}
    </Modalize>
  );
});

BottomBarModal.displayName = 'BottomBarModal';

export default BottomBarModal;
