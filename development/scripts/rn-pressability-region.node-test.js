// cspell:words Pressibility

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const babel = require('@babel/core');

const filename = path.resolve(
  __dirname,
  '../../node_modules/react-native/Libraries/Pressability/Pressability.js',
);
const source = babel.transformSync(fs.readFileSync(filename, 'utf8'), {
  filename,
  configFile: false,
  babelrc: false,
  plugins: [
    'babel-plugin-syntax-hermes-parser',
    '@babel/plugin-transform-flow-strip-types',
    '@babel/plugin-transform-modules-commonjs',
  ],
}).code;

function createPress(platform, config = {}) {
  const module = { exports: {} };
  const timers = new Map();
  const measurements = [];
  let timerId = 0;
  vm.runInNewContext(source, {
    module,
    exports: module.exports,
    process: { env: { NODE_ENV: 'test' } },
    require(name) {
      if (name.endsWith('ReactNativeFeatureFlags')) {
        return { shouldPressibilityUseW3CPointerEventsForHover: () => false };
      }
      if (name.endsWith('SoundManager')) return { playTouchSound() {} };
      if (name.endsWith('UIManager')) {
        return { measure: (_id, callback) => measurements.push(callback) };
      }
      if (name.endsWith('/Rect')) {
        return {
          normalizeRect: (rect) =>
            typeof rect === 'number'
              ? { top: rect, left: rect, bottom: rect, right: rect }
              : rect,
        };
      }
      if (name.endsWith('Platform')) return { OS: platform };
      if (name.endsWith('HoverState')) return { isHoverEnabled: () => false };
      if (name.endsWith('PressabilityPerformanceEventEmitter.js')) {
        return { emitEvent() {} };
      }
      if (name === 'invariant') return require('invariant');
      throw new Error(`Unexpected dependency: ${name}`);
    },
    setTimeout(callback, delay) {
      timerId += 1;
      timers.set(timerId, { callback, delay });
      return timerId;
    },
    clearTimeout: (id) => timers.delete(id),
    performance,
    Date,
  });
  const counts = { press: 0, long: 0 };
  const pressStateMachine = new module.exports.default({
    delayPressIn: 50,
    onPress: () => {
      counts.press += 1;
    },
    onLongPress: () => {
      counts.long += 1;
    },
    ...config,
  });
  const handlers = pressStateMachine.getEventHandlers();
  return {
    counts,
    handlers,
    pressStateMachine,
    measurements,
    event(
      pageY = 376,
      currentTarget = { measure: (cb) => measurements.push(cb) },
    ) {
      return {
        currentTarget,
        nativeEvent: { pageX: 100, pageY },
        persist() {},
        stopPropagation() {},
      };
    },
    measure(index, pageY = 224) {
      measurements[index](0, 0, 300, 68, 0, pageY);
    },
    runTimers(maxDelay) {
      // Callbacks can schedule new timers; only run the current batch.
      for (const [id, timer] of Array.from(timers)) {
        if (timers.has(id) && timer.delay <= maxDelay) {
          timers.delete(id);
          timer.callback();
        }
      }
    },
  };
}

for (const platform of ['android', 'ios']) {
  test(`${platform}: a zero-distance MOVE before press-in survives a stale region`, () => {
    const p = createPress(platform);
    p.handlers.onResponderGrant(p.event());
    p.measure(0);
    p.handlers.onResponderMove(p.event());
    p.runTimers(50);
    p.handlers.onResponderMove(p.event(377));
    p.handlers.onResponderRelease(p.event(377));
    assert.equal(p.counts.press, 1);
  });

  test(`${platform}: native scroll termination still cancels an invalid-region press`, () => {
    const p = createPress(platform);
    p.handlers.onResponderGrant(p.event());
    p.measure(0);
    p.runTimers(50);
    assert.equal(p.handlers.onResponderTerminationRequest(), true);
    p.handlers.onResponderTerminate(p.event(450));
    p.runTimers(1000);
    assert.deepEqual(p.counts, { press: 0, long: 0 });
  });

  test(`${platform}: valid regions still cancel outside and reactivate on re-entry`, () => {
    for (const reenter of [false, true]) {
      const p = createPress(platform);
      p.handlers.onResponderGrant(p.event());
      p.measure(0, 350);
      p.handlers.onResponderMove(p.event(500));
      if (reenter) p.handlers.onResponderMove(p.event());
      p.handlers.onResponderRelease(p.event(reenter ? 376 : 500));
      assert.equal(p.counts.press, reenter ? 1 : 0);
    }
  });

  test(`${platform}: late measurements cannot validate or invalidate the next gesture`, () => {
    const p = createPress(platform);
    p.handlers.onResponderGrant(p.event());
    p.handlers.onResponderTerminate(p.event());
    p.handlers.onResponderGrant(p.event());
    p.measure(1, 350);
    p.measure(0);
    p.handlers.onResponderMove(p.event(500));
    p.handlers.onResponderRelease(p.event(500));
    assert.equal(p.counts.press, 0);
  });

  test(`${platform}: an invalid region stays ignored until the next grant`, () => {
    const p = createPress(platform);
    p.handlers.onResponderGrant(p.event());
    p.runTimers(50); // Activation schedules a second measurement.
    p.measure(0);
    p.measure(1, 350);
    p.handlers.onResponderMove(p.event(500));
    p.handlers.onResponderRelease(p.event(500));
    assert.equal(p.counts.press, 1);
    p.handlers.onResponderGrant(p.event());
    p.measure(2, 350);
    p.handlers.onResponderMove(p.event(500));
    p.handlers.onResponderRelease(p.event(500));
    assert.equal(p.counts.press, 1);
  });

  test(`${platform}: finger movement still cancels long press with an invalid region`, () => {
    const p = createPress(platform);
    p.handlers.onResponderGrant(p.event());
    p.measure(0);
    p.runTimers(50);
    p.handlers.onResponderMove(p.event(450));
    p.runTimers(1000);
    assert.equal(p.counts.long, 0);
    p.handlers.onResponderTerminate(p.event(450));
  });

  test(`${platform}: numeric responders retain configured hitSlop`, () => {
    const p = createPress(platform, { hitSlop: 60 });
    p.handlers.onResponderGrant(p.event(376, 42));
    p.measure(0, 300);
    p.handlers.onResponderMove(p.event(400));
    p.handlers.onResponderRelease(p.event(400));
    assert.equal(p.counts.press, 1);
  });

  test(`${platform}: nested accessibility clicks do not invoke the parent`, () => {
    const p = createPress(platform);
    p.handlers.onClick({ ...p.event(), currentTarget: 1, target: 2 });
    assert.equal(p.counts.press, 0);
  });
}
