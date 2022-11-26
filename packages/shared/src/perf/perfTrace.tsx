import platformEnv from '../platformEnv';

import type { FirebasePerformanceTypes } from '@react-native-firebase/perf';

// @ts-ignore
const noop: () => Promise<FirebasePerformanceTypes.Trace> = async (
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  id: string,
) => {};

const isDev = !platformEnv.isProduction && process.env.BUILD_NUMBER !== '1';

const getPerf = isDev
  ? () => ({
      startTrace: noop,
      newTrace: noop,
    })
  : async () => {
      const module = await import('@react-native-firebase/perf');
      return module.firebase.perf();
    };

const traceMap: Record<string, FirebasePerformanceTypes.Trace> = {};

export const startTrace = isDev
  ? noop
  : async (id: string) => {
      const perf = await getPerf();
      traceMap[id] = await perf.startTrace(id);
      return traceMap[id];
    };

export const stopTrace = isDev
  ? noop
  : (id: string) => {
      traceMap[id]?.stop().finally(() => {
        delete traceMap[id];
      });
    };
