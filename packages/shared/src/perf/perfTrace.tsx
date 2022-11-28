import platformEnv from '../platformEnv';

import type { FirebasePerformanceTypes } from '@react-native-firebase/perf';

// @ts-ignore
const noop: () => Promise<FirebasePerformanceTypes.Trace> = async (
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  id: string,
) => {};

const enableTrace = platformEnv.isProduction;

const getPerf = () => ({
  startTrace: noop,
  newTrace: noop,
});

const traceMap: Record<string, FirebasePerformanceTypes.Trace> = {};

export const startTrace = enableTrace
  ? async (id: string) => {
      const perf = await getPerf();
      traceMap[id] = await perf.startTrace(id);
      return traceMap[id];
    }
  : noop;

export const stopTrace = enableTrace
  ? (id: string) => {
      traceMap[id]?.stop().finally(() => {
        delete traceMap[id];
      });
    }
  : noop;
