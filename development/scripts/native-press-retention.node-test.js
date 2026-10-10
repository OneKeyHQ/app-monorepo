const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const babel = require('@babel/core');

const root = path.resolve(__dirname, '../..');
const entries = [
  'src/helpers/mainThreadPressEvents.native.ts',
  'dist/cjs/helpers/mainThreadPressEvents.native.js',
  'dist/esm/helpers/mainThreadPressEvents.native.js',
];

function transpile(source, filename) {
  return babel.transformSync(source, {
    filename,
    configFile: false,
    babelrc: false,
    plugins: [
      '@babel/plugin-transform-typescript',
      '@babel/plugin-transform-modules-commonjs',
    ],
  }).code;
}

function responder(entry, platform, { deferredMeasure = false, onPress } = {}) {
  const filename = path.join(root, 'node_modules/@tamagui/web', entry);
  const module = { exports: {} };
  const measurements = [];
  const timers = new Map();
  let timerId = 0;
  vm.runInNewContext(transpile(fs.readFileSync(filename, 'utf8'), filename), {
    module,
    exports: module.exports,
    require(name) {
      if (name === 'react') return { useRef: () => ({ current: null }) };
      if (name === 'react-native') return { Platform: { OS: platform } };
      if (name === '@tamagui/native') {
        return { unstable_hasExternalPressOwnership: () => false };
      }
      throw new Error(`Unexpected dependency: ${name}`);
    },
    setTimeout(callback) {
      timerId += 1;
      timers.set(timerId, callback);
      return timerId;
    },
    clearTimeout(id) {
      timers.delete(id);
    },
    Date,
  });
  const props = {};
  const counts = { press: 0, out: 0, long: 0 };
  module.exports.useMainThreadPressEvents(
    {
      onPress: (e) => {
        counts.press += 1;
        onPress?.(e);
      },
      onPressOut: () => {
        counts.out += 1;
      },
      onLongPress: () => {
        counts.long += 1;
      },
      minPressDuration: 0,
    },
    props,
  );
  const event = (x, y) => ({
    currentTarget: {
      measure(callback) {
        if (deferredMeasure) {
          measurements.push(callback);
        } else {
          callback(0, 0, 100, 44, 20, 100);
        }
      },
    },
    nativeEvent: { pageX: x, pageY: y },
  });
  if (!deferredMeasure) props.onResponderGrant(event(60, 120));
  return {
    props,
    counts,
    event,
    measure(index, rect = [0, 0, 100, 44, 20, 100]) {
      measurements[index](...rect);
    },
    runTimers() {
      const callbacks = [...timers.values()];
      timers.clear();
      callbacks.forEach((callback) => callback());
    },
  };
}

// Use RN's real pooling and warning behavior without loading its native renderer.
const fabricFilename = path.join(
  root,
  'node_modules/react-native/Libraries/Renderer/implementations/ReactFabric-dev.js',
);
const fabricSource = fs.readFileSync(fabricFilename, 'utf8');
const syntheticEventParts = [];
const fabricAst = babel.parseSync(fabricSource, {
  configFile: false,
  babelrc: false,
});
babel.traverse(fabricAst, {
  FunctionDeclaration({ node }) {
    if (
      [
        'SyntheticEvent',
        'getPooledWarningPropertyDefinition',
        'functionThatReturnsTrue',
        'functionThatReturnsFalse',
      ].includes(node.id?.name)
    ) {
      syntheticEventParts.push(fabricSource.slice(node.start, node.end));
    }
  },
  ExpressionStatement({ node }) {
    const source = fabricSource.slice(node.start, node.end);
    if (
      source.startsWith('assign(SyntheticEvent.prototype,') ||
      source.startsWith('SyntheticEvent.Interface =')
    ) {
      syntheticEventParts.push(source);
    }
  },
});
assert.equal(syntheticEventParts.length, 6);

const sharedPressFilename = path.join(
  root,
  'packages/components/src/primitives/Button/useEvent.ts',
);
const sharedPressModule = { exports: {} };
vm.runInNewContext(
  transpile(fs.readFileSync(sharedPressFilename, 'utf8'), sharedPressFilename),
  {
    module: sharedPressModule,
    exports: sharedPressModule.exports,
    require(name) {
      if (name === 'react') {
        return {
          useMemo: (callback) => callback(),
          useCallback: (callback) => callback,
        };
      }
      if (name === 'lodash') return require('lodash');
      if (name === '@onekeyhq/shared/src/logger/logger') {
        return { defaultLogger: {} };
      }
      throw new Error(`Unexpected dependency: ${name}`);
    },
  },
);

for (const platform of ['ios', 'android']) {
  for (const entry of entries) {
    test(`${platform} ${entry}: taps remain active, drags and cancellation do not press`, () => {
      const tap = responder(entry, platform);
      tap.props.onResponderRelease(tap.event(60, 120));
      assert.equal(tap.counts.press, 1);

      const drag = responder(entry, platform);
      drag.props.onResponderMove(drag.event(83, 122));
      drag.props.onResponderMove(drag.event(83, 310));
      drag.props.onResponderRelease(drag.event(83, 310));
      assert.equal(drag.counts.press, 0);
      assert.equal(drag.counts.out, 1);

      const coalesced = responder(entry, platform);
      coalesced.props.onResponderRelease(coalesced.event(60, 310));
      assert.equal(coalesced.counts.press, 0);

      const returned = responder(entry, platform);
      returned.props.onResponderMove(returned.event(60, 310));
      returned.props.onResponderMove(returned.event(60, 120));
      returned.props.onResponderRelease(returned.event(60, 120));
      assert.equal(returned.counts.press, 1);

      const cancelled = responder(entry, platform);
      cancelled.props.onResponderTerminate(cancelled.event(60, 120));
      assert.equal(cancelled.counts.press, 0);
    });

    test(`${platform} ${entry}: stale G1 measurement cannot cancel or overwrite G2`, () => {
      for (const measuredFirst of [false, true]) {
        const h = responder(entry, platform, { deferredMeasure: true });
        h.props.onResponderGrant(h.event(60, 120));
        h.props.onResponderTerminate(h.event(60, 120));
        h.props.onResponderGrant(h.event(260, 320));
        if (measuredFirst) h.measure(1, [0, 0, 100, 44, 220, 300]);
        h.measure(0);
        h.props.onResponderRelease(h.event(260, 320));
        assert.equal(h.counts.press, 1);
      }
    });

    test(`${platform} ${entry}: late measurement uses latest outside move and cancels long press`, () => {
      const h = responder(entry, platform, { deferredMeasure: true });
      h.props.onResponderGrant(h.event(60, 120));
      const outside = h.event(60, 310);
      h.props.onResponderMove(outside);
      outside.nativeEvent.pageY = 120;
      h.measure(0);
      h.runTimers();
      assert.equal(h.counts.long, 0);
      assert.equal(h.counts.out, 1);
      h.props.onResponderRelease(h.event(60, 310));
      assert.equal(h.counts.press, 0);

      h.props.onResponderGrant(h.event(60, 120));
      h.measure(1);
      h.runTimers();
      assert.equal(h.counts.long, 1);
      h.props.onResponderRelease(h.event(60, 120));
      assert.equal(h.counts.press, 0);
    });

    test(`${platform} ${entry}: real pooled release survives useSharedPress debounce`, async () => {
      const warnings = [];
      let stops = 0;
      let deferredEvent;
      const context = {
        assign: Object.assign,
        Date,
        console: { error: (...args) => warnings.push(args) },
      };
      vm.createContext(context);
      vm.runInContext(
        `${syntheticEventParts.join('\n')}\nthis.Event = SyntheticEvent;`,
        context,
      );
      const { onPress } = sharedPressModule.exports.useSharedPress({
        onPress(e) {
          e.stopPropagation();
          deferredEvent = e;
        },
      });
      const h = responder(entry, platform, { onPress });
      const release = new context.Event(
        {},
        null,
        {
          pageX: 60,
          pageY: 120,
          stopPropagation() {
            stops += 1;
          },
        },
        null,
      );
      h.props.onResponderRelease(release);
      release.currentTarget = null;
      if (!release.isPersistent()) release.destructor();
      await new Promise((resolve) => setTimeout(resolve, 10));
      assert.equal(h.counts.press, 1);
      assert.equal(deferredEvent, release);
      assert.equal(deferredEvent.nativeEvent.pageX, 60);
      assert.equal(stops, 2);
      assert.equal(warnings.length, 0);
    });
  }
}
