import React from 'react';

import {
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';

import type { GestureResponderHandlers, LayoutChangeEvent } from 'react-native';

type RBSheetProps = {
  children: React.ReactNode;
  onModalHide?: () => void;
  toggleVisible?: () => void; // 兼容原来的Select写法
};

type RBSheetRef = {
  open: () => void;
  close: () => void;
};

const s = StyleSheet.create({
  wrapper: {
    flex: 1,
    height: '100%',
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'flex-end',
  },
  mask: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: '100%',
    backgroundColor: 'rgba(0,0,0,0.7)', // 0.7不透明度从原来三方组件中获得
  },
  container: {
    position: 'relative',
    overflow: 'hidden',
    width: '100%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: '#000000',
  },
  dragArea: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '90%',
    height: 50,
    backgroundColor: 'transparent',
    // backgroundColor: 'rgba(0,0,255,0.4)',
  },
});

type Position = {
  x: number;
  y: number;
};

const ANIMATION_DURATION = 150;

const RBSheet = React.forwardRef<RBSheetRef, RBSheetProps>(
  ({ children, onModalHide, toggleVisible }, ref) => {
    const [visible, setVisible] = React.useState(false);

    const initialPostion = React.useRef<Position>({ x: 0, y: 0 });

    const pan = React.useRef(new Animated.ValueXY()).current;

    const containerHeight = React.useRef(0);

    // PanResponder为啥项目里不能用啊
    // 手势跟踪
    // const panResponder = React.useRef(
    //   PanResponder.create({
    //     onStartShouldSetPanResponder: () => true,
    //     onPanResponderMove: (e, gestureState) => {
    //       //console.log('move on');
    //       if (gestureState.dy > 0) {
    //         Animated.event([null, { dy: pan.y }], { useNativeDriver: true })(
    //           e,
    //           gestureState,
    //         );
    //       }
    //     },
    //     onPanResponderRelease: (e, gestureState) => {
    //       //console.log('move end');
    //       if (gestureState.dy * 4 < containerHeight.current) {
    //         //console.log('drag a little, do nothing');
    //         Animated.timing(pan, {
    //           toValue: { x: 0, y: 0 },
    //           duration: ANIMATION_DURATION,
    //           useNativeDriver: true,
    //         }).start();
    //       } else {
    //         //console.log('drag a lot, close sheet');
    //         close();
    //       }
    //     },
    //   }),
    // ).current;

    const open = () => {
      if (visible === true) {
        return;
      }

      setVisible(true);
      pan.setValue({ x: 0, y: containerHeight.current });
      Animated.timing(pan, {
        toValue: { x: 0, y: 0 },
        duration: ANIMATION_DURATION,
        useNativeDriver: true,
      }).start();
    };

    const close = () => {
      // if (visible === false) {
      //   return
      // }
      Animated.timing(pan, {
        toValue: { x: 0, y: containerHeight.current },
        duration: ANIMATION_DURATION,
        useNativeDriver: true,
      }).start(() => {
        // sheet已沉底
        setVisible(false);
        onModalHide?.();
      });
    };

    const innerClose = () => {
      // if (visible === false) {
      //   return
      // }
      Animated.timing(pan, {
        toValue: { x: 0, y: containerHeight.current },
        duration: ANIMATION_DURATION,
        useNativeDriver: true,
      }).start(() => {
        // sheet已沉底
        setVisible(false);
        onModalHide?.();
        toggleVisible?.();
      });
    };

    // PanResponder为什么项目里不能用
    const panHandlers: GestureResponderHandlers = {
      onStartShouldSetResponder: () => true,
      onResponderGrant: (evt) => {
        // 设置初始位置
        // //console.log('initial start');
        const currentPos = {
          x: evt.nativeEvent.pageX,
          y: evt.nativeEvent.pageY,
        };
        initialPostion.current = currentPos;
      },
      onResponderMove: (evt) => {
        // //console.log('on move');
        const currentPos = {
          x: evt.nativeEvent.pageX,
          y: evt.nativeEvent.pageY,
        };
        // const x = currentPos.x - initialPostion.current.x;
        const y = currentPos.y - initialPostion.current.y;

        if (y > 0) {
          pan.setValue({ x: 0, y });
        }
      },
      onResponderRelease: (evt) => {
        const currentPos = {
          x: evt.nativeEvent.pageX,
          y: evt.nativeEvent.pageY,
        };
        const dy = Math.floor(currentPos.y - initialPostion.current.y);
        if (dy > 40) {
          innerClose();
        } else {
          Animated.timing(pan, {
            toValue: { x: 0, y: 0 },
            useNativeDriver: true,
            duration: ANIMATION_DURATION,
          }).start();
        }
      },
    };

    React.useImperativeHandle(ref, () => ({
      open,
      close,
    }));

    const getHeight = React.useCallback((e: LayoutChangeEvent) => {
      containerHeight.current = Math.floor(e.nativeEvent.layout.height);
      // console.log('container height1=', containerHeight.current);
    }, []);

    const panStyle = { transform: pan.getTranslateTransform() };

    return (
      <Modal
        transparent
        visible={visible}
        animationType="none"
        onRequestClose={innerClose}
      >
        <KeyboardAvoidingView enabled={Platform.OS === 'ios'} style={s.wrapper}>
          <Pressable style={s.mask} onPress={innerClose} />
          <Animated.View style={[s.container, panStyle]} onLayout={getHeight}>
            {children}
            <View
              style={s.dragArea}
              // {...panResponder.panHandlers}
              {...panHandlers}
            />
          </Animated.View>
        </KeyboardAvoidingView>
      </Modal>
    );
  },
);

RBSheet.displayName = 'RBSheet';

export default RBSheet;

export type { RBSheetProps, RBSheetRef };
