/* eslint-disable react/destructuring-assignment, react/state-in-constructor */
// eslint-disable-next-line max-classes-per-file
import { PureComponent } from 'react';

import { Box, Button, Typography } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

type ErrorBoundaryProps = {
  onError?: (error: Error, componentStack: string | null) => void;
};
type ErrorBoundaryState = { error: Error | null };

class ErrorBoundaryBase extends PureComponent<
  ErrorBoundaryProps,
  ErrorBoundaryState
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

class ErrorBoundary extends ErrorBoundaryBase {
  override render() {
    if (platformEnv.isDev && this.state.error) {
      return (
        // The component has to be unmounted or else it would continue to error
        <Box flex="1" bg="background-default" px={4} py={8}>
          <Button
            onPress={() => {
              if (platformEnv.isRuntimeBrowser) {
                window.location.href = '#/';
                window.location.reload();
              }
            }}
          >
            Back to HOME
          </Button>
          <Typography.PageHeading>
            Error: {this.state.error?.name}
          </Typography.PageHeading>
          <Typography.Body1Strong>
            {this.state.error?.message}
          </Typography.Body1Strong>
          <Typography.Caption>{this.state.error?.stack}</Typography.Caption>
        </Box>
      );
    }
    return this.props.children;
  }
}

export { ErrorBoundary, ErrorBoundaryBase };
