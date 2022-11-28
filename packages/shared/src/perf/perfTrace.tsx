import platformEnv from '../platformEnv';

import type { FirebasePerformanceTypes } from '@react-native-firebase/perf';

// @ts-ignore
const noop: () => Promise<FirebasePerformanceTypes.Trace> = async (
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  id: string,
) => {};

const enableTrace = platformEnv.isProduction;

const getPerf = enableTrace
  ? () => ({
      startTrace: noop,
      newTrace: noop,
    })
  : async () => {
      const module = await import('@react-native-firebase/perf');
      return module.firebase.perf();
    };

const traceMap: Record<string, FirebasePerformanceTypes.Trace> = {};

export const startTrace = enableTrace
  ? noop
  : async (id: string) => {
      const perf = await getPerf();
      traceMap[id] = await perf.startTrace(id);
      return traceMap[id];
    };

export const stopTrace = enableTrace
  ? noop
  : (id: string) => {
      traceMap[id]?.stop().finally(() => {
        delete traceMap[id];
      });
    };
