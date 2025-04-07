/* eslint-disable react/destructuring-assignment, react/state-in-constructor */
// eslint-disable-next-line max-classes-per-file
import { PureComponent } from 'react';

import { SafeAreaView, Text } from 'react-native';

import { captureException } from '@onekeyhq/shared/src/modules3rdParty/sentry';

type IErrorBoundaryProps = {
  children: React.ReactNode;
  onError?: (error: Error, componentStack: string | null) => void;
};
type IErrorBoundaryState = { error: Error | null };

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
    captureException(error);
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
        <SafeAreaView>
          <Text>{this.state.error.message}</Text>
        </SafeAreaView>
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
    <SafeAreaView>
      <Text>
        {(error as Error | undefined)?.message ||
          'unknown error by error boundary'}
      </Text>
    </SafeAreaView>
  );
}

export { ErrorBoundaryBase, ErrorBoundarySimple, SentryErrorBoundaryFallback };
