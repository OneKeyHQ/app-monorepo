/* eslint-disable react/destructuring-assignment, react/state-in-constructor */
// eslint-disable-next-line max-classes-per-file
import { PureComponent } from 'react';

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

export { ErrorBoundaryBase };
