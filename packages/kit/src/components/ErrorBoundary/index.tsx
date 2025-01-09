/* eslint-disable react/destructuring-assignment, react/state-in-constructor */
// eslint-disable-next-line max-classes-per-file
import { PureComponent } from 'react';

import { SizableText } from '@onekeyhq/components/src/primitives/SizeableText';

import type { FallbackRender } from '@sentry/react';

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
  }

  override render() {
    // eslint-disable-next-line react/prop-types
    return this.props.children;
  }
}

class ErrorBoundarySimple extends ErrorBoundaryBase {
  override render() {
    if (this.state.error) {
      return <SizableText>{this.state.error.message}</SizableText>;
    }
    return this.props.children;
  }
}

const sentryErrorBoundaryFallback: FallbackRender = ({
  error,
  componentStack,
  eventId,
  resetError,
}: {
  error: unknown;
  componentStack: string;
  eventId: string;
  resetError(): void;
}) => (
  <SizableText>
    {error?.message || 'unknown error by error boundary'}
  </SizableText>
);

export { ErrorBoundaryBase, ErrorBoundarySimple, sentryErrorBoundaryFallback };
