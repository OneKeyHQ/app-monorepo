/* eslint-disable react/destructuring-assignment, react/state-in-constructor, max-classes-per-file */
import { PureComponent } from 'react';

import { StyleSheet, Text, View } from 'react-native';

import {
  LogLevel,
  NativeLogger,
} from '@onekeyhq/shared/src/modules3rdParty/react-native-file-logger';

type IErrorBoundaryProps = {
  children: React.ReactNode;
  onError?: (error: Error, componentStack: string | null) => void;
};
type IErrorBoundaryState = { error: Error | null };

const styles = StyleSheet.create({
  fallback: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
});

class ErrorBoundaryBase extends PureComponent<
  IErrorBoundaryProps,
  IErrorBoundaryState
> {
  // eslint-disable-next-line react/no-unused-state
  override state: { error: Error | null } = { error: null };

  override componentDidCatch(
    error: Error,
    // Loosely typed because it depends on the React version and was
    // accidentally excluded in some versions.
    errorInfo?: { componentStack?: string | null },
  ) {
    this.props?.onError?.(error, errorInfo?.componentStack || null);
    // eslint-disable-next-line react/no-unused-state
    this.setState({ error });
    void import('@onekeyhq/shared/src/modules3rdParty/sentry').then(
      ({ captureException, initSentry }) => {
        initSentry();
        captureException(error);
      },
    );
    NativeLogger.write(
      LogLevel.Error,
      `[ErrorBoundary] ${error?.message || error}\n${errorInfo?.componentStack?.slice(0, 500) || ''}`,
    );
  }

  override render() {
    // eslint-disable-next-line react/prop-types
    return this.props.children;
  }
}

class ErrorBoundarySimple extends ErrorBoundaryBase {
  override render() {
    if (this.state.error) {
      return (
        <View style={styles.fallback}>
          <Text>{this.state.error.message}</Text>
        </View>
      );
    }
    return this.props.children;
  }
}

function SentryErrorBoundaryFallback({
  error,
}: {
  error: unknown;
  componentStack: string;
  eventId: string;
  resetError(): void;
}) {
  return (
    <View style={styles.fallback}>
      <Text>
        {(error as Error | undefined)?.message ||
          'unknown error by error boundary'}
      </Text>
    </View>
  );
}

export { ErrorBoundaryBase, ErrorBoundarySimple, SentryErrorBoundaryFallback };
