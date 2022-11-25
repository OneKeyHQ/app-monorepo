import platformEnv from '../platformEnv';

import type { FirebasePerformanceTypes } from '@react-native-firebase/perf';

const noop = () => {};

const isDev = !platformEnv.isProduction && process.env.BUILD_NUMBER !== '1';

export const getPerfTrace = isDev
  ? () => ({
      startTrace: noop,
      newTrace: noop,
    })
  : async () => {
      const module = await import('@react-native-firebase/perf');
      return module.firebase.perf();
    };

let jsRenderTrace: FirebasePerformanceTypes.Trace | void;

let jsRenderTimer: number;
export const startTraceJsRender = isDev
  ? noop
  : async () => {
      jsRenderTimer = Date.now();
      const perf = await getPerfTrace();
      jsRenderTrace = await perf.startTrace('js_render');
    };

export const stopTraceJsRender = isDev
  ? noop
  : () => {
      jsRenderTrace?.putMetric('duration', Date.now() - jsRenderTimer);
      jsRenderTrace?.stop();
    };
