import { useState } from 'react';

import { Button, Stack, TextAreaInput } from '@onekeyhq/components';

import { Layout } from './utils/Layout';

// Simple type definitions for our Jest mocks
interface IMockFunction {
  (name: string, fn: () => void | Promise<void>): void;
  only: (name: string, fn: () => void) => void;
  skip: (name: string, fn: () => void) => void;
  each: <T>(table: T[]) => (name: string, fn: (value: T) => void) => void;
}

interface IMockDescribe extends IMockFunction {
  each: <T>(table: T[]) => (name: string, fn: (value: T) => void) => void;
}

interface IMockIt extends IMockFunction {
  todo: (name: string) => void;
  concurrent: (name: string, fn: () => void) => void;
  failing: (name: string, fn: () => void) => void;
}

interface IGlobalWithTest {
  describe: IMockDescribe;
  expect: IMockExpect;
  it: IMockIt;
}

interface IMockExpect {
  (actual: unknown): {
    toBe: (expected: unknown) => void;
    toEqual: (expected: unknown) => void;
    toBeInstanceOf: (expected: { new (...args: any[]): unknown }) => void;
    toMatch: (expected: RegExp | string) => void;
    toMatchSnapshot: (name?: string) => void;
    toHaveLength: (expected: number) => void;
    toBeDefined: () => void;
    toThrow: (expected?: { new (...args: any[]): Error }) => void;
    rejects: {
      toThrow: (expected?: { new (...args: any[]): Error }) => Promise<void>;
    };
    anything: () => boolean;
    any: (constructor: { new (...args: any[]): unknown }) => boolean;
    arrayContaining: (arr: unknown[]) => boolean;
    assertions: (num: number) => void;
    objectContaining: (obj: Record<string, unknown>) => boolean;
    stringContaining: (str: string) => boolean;
    stringMatching: (regex: RegExp) => boolean;
  };
}

function UnitTestGallery() {
  interface ITestProgress {
    currentSuite: number;
    totalSuites: number;
    currentTest: number;
    totalTests: number;
  }

  const [log, setLog] = useState<string>('');
  const [failures, setFailures] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [progress, setProgress] = useState<ITestProgress>({
    currentSuite: 0,
    totalSuites: 0,
    currentTest: 0,
    totalTests: 0,
  });

  const runTests = async () => {
    setLoading(true);
    setLog('');
    setFailures('');
    setProgress({
      currentSuite: 0,
      totalSuites: 0,
      currentTest: 0,
      totalTests: 0,
    });

    // Mock Jest environment
    const testLogs: string[] = [];
    const testErrors: string[] = [];

    let suiteCount = 0;
    let testCount = 0;

    const createMockIt = (
      options: { logs?: string[]; errors?: string[] } = {},
    ) => {
      const { logs, errors } = options;

      const mockIt = ((testName: string, testFn: () => void) => {
        testCount += 1;
        logs?.push(`\nit: ${String(testName)}...`);
        setProgress((prev) => ({
          ...prev,
          currentTest: testCount,
          totalTests: Math.max(prev.totalTests, testCount)
        }));
        try {
          testFn();
          logs?.push('PASSED');
        } catch (err: unknown) {
          logs?.push('FAILED');
          const errMsg = err instanceof Error ? err.message : String(err);
          errors?.push(`(it error) ${String(testName)}: ${errMsg}`);
        }
      }) as IMockIt;

      // Add required Jest.It properties
      const noop = () => {};
      mockIt.todo = noop;
      mockIt.concurrent = mockIt;
      mockIt.only = mockIt;
      mockIt.failing = mockIt;
      mockIt.skip = noop;
      mockIt.each = () => noop;

      return mockIt;
    };

    const createMockDescribe = (
      options: { logs?: string[]; errors?: string[] } = {},
    ) => {
      const { logs, errors } = options;

      const mockDescribe = ((suiteName: string, suiteFn: () => void) => {
        suiteCount += 1;
        logs?.push(`\n--- describe: ${String(suiteName)} ---`);
        setProgress((prev) => ({
          ...prev,
          currentSuite: suiteCount,
          totalSuites: Math.max(prev.totalSuites, suiteCount)
        }));

        const originalIt = (globalThis as unknown as { it?: IMockIt }).it;
        (globalThis as unknown as { it: IMockIt }).it = createMockIt(options);

        try {
          suiteFn();
        } catch (err: unknown) {
          const errMsg = err instanceof Error ? err.message : String(err);
          errors?.push(`(describe error) ${errMsg}`);
        }

        (globalThis as unknown as { it?: IMockIt }).it = originalIt;
      }) as IMockDescribe;

      // Add required Jest.Describe properties
      mockDescribe.only = mockDescribe;
      mockDescribe.skip = () => {};
      mockDescribe.each = () => () => {};

      return mockDescribe;
    };

    // Set up test environment
    const global = globalThis as unknown as IGlobalWithTest;
    global.describe = createMockDescribe({
      logs: testLogs,
      errors: testErrors,
    });

    global.expect = ((val: unknown) => ({
      toBe: (expected: any) => {
        if (val !== expected) {
          throw new Error(`Expected ${String(val)} to be ${String(expected)}`);
        }
      },
      toEqual: (expected: unknown) => {
        const valString = JSON.stringify(val);
        const expString = JSON.stringify(expected);
        if (valString !== expString) {
          throw new Error(
            `Expected ${String(valString)} to equal ${String(expString)}`,
          );
        }
      },
      toBeInstanceOf: (type: { new (...args: any[]): unknown }) => {
        if (!(val instanceof type)) {
          throw new Error(
            `Expected ${String(val)} to be instance of ${String(
              type?.name ?? 'unknown',
            )}`,
          );
        }
      },
      toMatch: (pattern: RegExp) => {
        if (!pattern.test(String(val))) {
          throw new Error(
            `Expected ${String(val)} to match ${String(pattern)}`,
          );
        }
      },
      toMatchSnapshot: (name?: string) => {
        testLogs.push(
          `(Snapshot test${
            name ? ` "${name}"` : ''
          } skipped in RN environment)`,
        );
      },
      toThrow: (ErrorType?: { new (...args: any[]): Error }) => {
        try {
          if (typeof val === 'function') {
            val();
          }
          throw new Error('Expected function to throw');
        } catch (err: unknown) {
          if (
            ErrorType &&
            err instanceof Error &&
            !(err instanceof ErrorType)
          ) {
            const errorTypeName = ErrorType?.name ?? 'unknown';
            throw new Error(
              `Expected error to be instance of ${String(errorTypeName)}`,
            );
          }
        }
      },
      toHaveLength: (length: number) => {
        const arrayLike = val as { length?: number };
        if (arrayLike?.length !== length) {
          throw new Error(
            `Expected length of ${String(arrayLike?.length)} to be ${String(
              length,
            )}`,
          );
        }
      },
      toBeDefined: () => {
        if (val === undefined) {
          throw new Error('Expected value to be defined');
        }
      },
      rejects: {
        toThrow: async (ErrorType?: { new (...args: any[]): Error }) => {
          try {
            await val;
            throw new Error('Expected promise to reject');
          } catch (err) {
            if (ErrorType && !(err instanceof ErrorType)) {
              const errorTypeName = ErrorType?.name ?? 'unknown';
              throw new Error(
                `Expected error to be instance of ${String(errorTypeName)}`,
              );
            }
          }
        },
      },
      // Additional Jest matchers required by the type system
      anything: () => true,
      any: (constructor: { new (...args: any[]): unknown }) =>
        val instanceof constructor,
      arrayContaining: (arr: unknown[]) =>
        Array.isArray(val) &&
        arr.every((item) => (val as unknown[]).includes(item)),
      assertions: () => {},
      objectContaining: (obj: Record<string, unknown>) => {
        const record = val as Record<string, unknown>;
        for (const key in obj) {
          if (record[key] !== obj[key]) return false;
        }
        return true;
      },
      stringContaining: (str: string) =>
        typeof val === 'string' && val.includes(str),
      stringMatching: (regex: RegExp) =>
        typeof val === 'string' && regex.test(val),
    })) as IMockExpect;

    try {
      // Dynamically import the test file
      // Remove .ts extension for TypeScript resolution
      await import('@onekeyhq/core/src/secret/__tests__/secret.test');

      // Log test module import success
      testLogs.push('\nTest module imported successfully');
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : String(e);
      testErrors.push(`Dynamic import failed: ${errMsg}`);
    } finally {
      setLog(testLogs.join('\n'));
      setFailures(testErrors.join('\n'));
      setLoading(false);
    }
  };

  return (
    <Layout
      description="Run Jest unit tests in React Native environment"
      suggestions={[
        'Click Run Tests to execute tests',
        'View test progress in real-time',
        'Check raw output and failures in separate text areas',
      ]}
      boundaryConditions={[
        'Tests are executed in RN environment',
        'Some Jest features may be limited',
        'Snapshot tests are skipped',
      ]}
      elements={[
        {
          title: 'Unit Test Runner',
          element: (
            <Stack space="$4">
              <Button onPress={runTests}>Run Tests</Button>
              {loading ? (
                <Stack
                  backgroundColor="$bgSubdued"
                  padding="$4"
                  borderRadius="$3"
                >
                  <Stack>
                    Running tests...{'\n'}
                    Test suite {progress.currentSuite}/{progress.totalSuites}
                    {'\n'}
                    Tests {progress.currentTest}/{progress.totalTests}
                  </Stack>
                </Stack>
              ) : null}
              <TextAreaInput
                value={log}
                placeholder="Raw Jest Output"
                multiline
                numberOfLines={10}
                editable={false}
              />
              <TextAreaInput
                value={failures}
                placeholder="Failures & Error Details"
                multiline
                numberOfLines={10}
                editable={false}
              />
            </Stack>
          ),
        },
      ]}
    />
  );
}

export default UnitTestGallery;
