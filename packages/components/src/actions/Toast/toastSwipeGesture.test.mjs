import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';

const require = createRequire(import.meta.url);
const { transformSync } = require('@swc/core');
const sourcePath =
  process.env.TOAST_SOURCE_PATH ??
  fileURLToPath(
    new URL(
      '../../../../../node_modules/@backpackapp-io/react-native-toast/src/components/Toast.tsx',
      import.meta.url,
    ),
  );
const source = readFileSync(sourcePath, 'utf8');
const compiled = transformSync(source, {
  jsc: {
    parser: { syntax: 'typescript', tsx: true },
    target: 'es2022',
    transform: { react: { runtime: 'classic' } },
  },
  module: { type: 'commonjs' },
}).code;

function mount({
  platform = 'ios',
  position = 'top',
  isSwipeable = true,
} = {}) {
  const hooks = [];
  const dismissals = [];
  const presses = [];
  let hookIndex = 0;
  let effects = [];
  let styleGetter;
  let gesture;
  let pressableProps;
  let offset = 20;
  let toast = {
    id: 'swipe-test',
    message: 'Swipe test',
    type: 'blank',
    visible: true,
    position,
    isSwipeable,
  };

  const sharedValue = (initial) => {
    const index = hookIndex;
    hookIndex += 1;
    return (hooks[index] ??= { value: initial });
  };
  const react = {
    createElement: (type, props, ...children) => ({ type, props, children }),
    useCallback: (callback) => callback,
    useEffect: (effect) => effects.push(effect),
    useMemo: (factory) => factory(),
    useRef: (initial) => {
      const index = hookIndex;
      hookIndex += 1;
      return (hooks[index] ??= { current: initial });
    },
    useState: (initial) => {
      const index = hookIndex;
      hookIndex += 1;
      hooks[index] ??= initial;
      return [hooks[index], (value) => (hooks[index] = value)];
    },
  };
  const makeGesture = (kind) => ({
    kind,
    enabled(value) {
      this.isEnabled = value;
      return this;
    },
    direction(value) {
      this.swipeDirection = value;
      return this;
    },
    onUpdate(callback) {
      this.update = callback;
      return this;
    },
    onBegin(callback) {
      this.begin = callback;
      return this;
    },
    onStart(callback) {
      this.start = callback;
      return this;
    },
    onEnd(callback) {
      this.end = callback;
      return this;
    },
    onFinalize(callback) {
      this.finalize = callback;
      return this;
    },
  });
  const modules = {
    react: { __esModule: true, ...react, default: react },
    'react-native': {
      Platform: {
        OS: platform,
        select: ({ ios, default: fallback }) =>
          platform === 'ios' ? ios : fallback,
      },
      Pressable: 'Pressable',
      Text: 'Text',
      View: 'View',
      useColorScheme: () => 'light',
      useWindowDimensions: () => ({ width: 400, height: 800 }),
    },
    'react-native-reanimated': {
      __esModule: true,
      default: { createAnimatedComponent: (component) => component },
      cancelAnimation: () => undefined,
      Easing: { inOut: (value) => value, quad: () => undefined },
      ReduceMotion: { System: 'system' },
      runOnJS: (callback) => callback,
      useAnimatedStyle: (callback) => {
        styleGetter = callback;
        return {};
      },
      useSharedValue: sharedValue,
      withSpring: (value) => value,
      withTiming: (value) => value,
    },
    'react-native-safe-area-context': {
      useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
    },
    'react-native-gesture-handler': {
      Directions: { UP: 1, DOWN: 2 },
      Gesture: {
        Pan: () => makeGesture('pan'),
        Fling: () => makeGesture('fling'),
        Simultaneous: (...gestures) => ({ kind: 'simultaneous', gestures }),
      },
      GestureDetector: 'GestureDetector',
    },
    '../core/types': {
      DismissReason: { SWIPE: 'swipe' },
      ToastPosition: {
        TOP: 'top',
        TOP_LEFT: 'top-left',
        TOP_RIGHT: 'top-right',
      },
      resolveValue: (value) => value,
    },
    '../utils': {
      colors: {},
      ConstructShadow: () => ({}),
      useVisibilityChange: () => undefined,
    },
    '../headless': { toast: { dismiss: (...args) => dismissals.push(args) } },
  };
  const module = { exports: {} };
  runInNewContext(`(function(require, module, exports) { ${compiled}\n})`, {
    Math,
  })(
    (specifier) => {
      assert.ok(specifier in modules, `Unexpected dependency: ${specifier}`);
      return modules[specifier];
    },
    module,
    module.exports,
  );

  const render = (changes = {}) => {
    toast = { ...toast, ...changes };
    offset = changes.offset ?? offset;
    hookIndex = 0;
    effects = [];
    const element = module.exports.Toast({
      toast,
      offset,
      updateHeight: () => undefined,
      startPause: () => undefined,
      endPause: () => undefined,
      onToastPress: () => presses.push('press'),
      keyboardHeight: 0,
    });
    gesture = element.props.gesture;
    pressableProps = element.children[0].props;
    effects.forEach((effect) => effect());
    return gesture;
  };
  render();
  const translateY = () => styleGetter().transform[0].translateY;
  const pan = () =>
    gesture.kind === 'simultaneous' ? gesture.gestures[1] : gesture;
  const swipe = (
    translationY,
    velocityY = 0,
    translationX = 0,
    success = true,
    physicalY = translationY,
    physicalX = translationX,
  ) => {
    const event = {
      translationY,
      translationX,
      velocityY,
      absoluteX: 200 + physicalX,
      absoluteY: 400 + physicalY,
    };
    pan().begin?.({ absoluteX: 200, absoluteY: 400 });
    pan().start?.(event);
    pan().update(event);
    pan().end(event, success);
    pan().finalize?.(event, success);
  };
  return {
    dismissals,
    presses,
    pan,
    render,
    swipe,
    translateY,
    getGesture: () => gesture,
    getPressableProps: () => pressableProps,
  };
}

test('iOS top toast dismisses on deliberate upward distance or velocity once', () => {
  const toast = mount();
  const base = toast.translateY();
  assert.equal(toast.getGesture().kind, 'pan');
  toast.pan().update({ translationY: -20, translationX: 0, velocityY: 0 });
  assert.equal(toast.translateY(), base - 20);
  toast.pan().end({ translationY: -20, translationX: 0, velocityY: 0 }, true);
  assert.equal(toast.translateY(), base);
  toast.swipe(-40);
  assert.deepEqual(toast.dismissals, [['swipe-test', 'swipe']]);
  toast.swipe(-50);
  assert.equal(toast.dismissals.length, 1);

  const fast = mount();
  fast.swipe(-12, -600);
  assert.equal(fast.dismissals.length, 1);
  const tooShort = mount();
  tooShort.swipe(-11, -1000);
  assert.equal(tooShort.dismissals.length, 0);
  const activationDistance = mount();
  activationDistance.swipe(-30, 0, 0, true, -40);
  assert.equal(activationDistance.dismissals.length, 1);
  const fastAfterActivation = mount();
  fastAfterActivation.swipe(-2, -600, 0, true, -12);
  assert.equal(fastAfterActivation.dismissals.length, 1);
});

test('iOS rejects sideways, reverse, short, and cancelled swipes', () => {
  for (const [dy, dx, velocity, success] of [
    [-40, 50, -1000, true],
    [40, 0, 1000, true],
    [-20, 0, -599, true],
    [-40, 0, -1000, false],
  ]) {
    const toast = mount();
    const base = toast.translateY();
    toast.swipe(dy, velocity, dx, success);
    assert.equal(toast.dismissals.length, 0);
    assert.equal(toast.translateY(), base);
  }
  const reverse = mount();
  const base = reverse.translateY();
  reverse.pan().update({ translationY: 40 });
  assert.equal(reverse.translateY(), base + 10);
  const physicalSideways = mount();
  physicalSideways.swipe(-30, 0, -5, true, -40, 50);
  assert.equal(physicalSideways.dismissals.length, 0);
  const syntheticTap = mount();
  syntheticTap.swipe(0, -1000, 0, true, -40);
  assert.equal(syntheticTap.dismissals.length, 0);
});

test('iOS drag capture suppresses toast press and preserves taps', () => {
  const toast = mount();
  const pressable = toast.getPressableProps();
  const down = { nativeEvent: { pageX: 200, pageY: 400 } };
  const upward = { nativeEvent: { pageX: 200, pageY: 360 } };
  const short = { nativeEvent: { pageX: 200, pageY: 389 } };
  const sideways = { nativeEvent: { pageX: 150, pageY: 395 } };
  pressable.onTouchStartCapture(down);
  assert.equal(pressable.onMoveShouldSetResponderCapture(short), false);
  assert.equal(pressable.onMoveShouldSetResponderCapture(sideways), false);
  pressable.onPress();
  assert.equal(toast.presses.length, 1);
  pressable.onTouchStartCapture(down);
  assert.equal(pressable.onMoveShouldSetResponderCapture(upward), true);
  pressable.onTouchMoveCapture(upward);
  pressable.onPress();
  assert.equal(toast.presses.length, 1);
  pressable.onTouchStartCapture(down);
  pressable.onPress();
  assert.equal(toast.presses.length, 2);
  pressable.onTouchStartCapture(down);
  pressable.onTouchMoveCapture(upward);
  pressable.onPress();
  assert.equal(toast.presses.length, 2);
  toast.render({ visible: false });
  toast.getPressableProps().onPress();
  assert.equal(toast.presses.length, 2);
  const disabled = mount({ isSwipeable: false });
  const disabledPressable = disabled.getPressableProps();
  disabledPressable.onTouchStartCapture(down);
  assert.equal(
    disabledPressable.onMoveShouldSetResponderCapture(upward),
    false,
  );
  disabledPressable.onPress();
  assert.equal(disabled.presses.length, 1);
});

test('iOS bottom toast swipes downward and disabled toast cannot dismiss', () => {
  const bottom = mount({ position: 'bottom' });
  bottom.swipe(32);
  assert.equal(bottom.dismissals.length, 1);
  const disabled = mount({ isSwipeable: false });
  assert.equal(disabled.pan().isEnabled, false);
  disabled.swipe(-50, -1000);
  assert.equal(disabled.dismissals.length, 0);
  const transitioning = mount();
  transitioning.pan().start();
  transitioning.pan().update({ translationY: -20 });
  const oldPan = transitioning.pan();
  transitioning.render({ isSwipeable: false });
  oldPan.end({ translationY: -50, translationX: 0, velocityY: -1000 }, true);
  assert.equal(transitioning.dismissals.length, 0);
  assert.equal(transitioning.translateY(), 20);
});

test('iOS stack changes preserve active drag; external close blocks a late release', () => {
  const toast = mount();
  toast.pan().update({ translationY: -20 });
  const before = toast.translateY();
  toast.render({ offset: 35 });
  assert.equal(toast.translateY(), before + 15);
  const stalePan = toast.pan();
  toast.render({ visible: false });
  stalePan.end({ translationY: -50, translationX: 0, velocityY: -1000 }, true);
  stalePan.finalize?.({}, false);
  assert.equal(toast.dismissals.length, 0);
  toast.render({ visible: true });
  assert.equal(toast.translateY(), 35);
  toast.swipe(-40);
  assert.equal(toast.dismissals.length, 1);
});

test('Android retains the original simultaneous fling and pan', () => {
  const toast = mount({ platform: 'android' });
  const gesture = toast.getGesture();
  assert.equal(gesture.kind, 'simultaneous');
  assert.deepEqual(
    gesture.gestures.map(({ kind }) => kind),
    ['fling', 'pan'],
  );
  const base = toast.translateY();
  toast.pan().update({ translationY: -40 });
  assert.equal(toast.translateY(), base - 10);
  toast.pan().end({ translationY: -40 });
  assert.equal(toast.translateY(), base);
  gesture.gestures[0].end();
  assert.equal(toast.dismissals.length, 1);
});
