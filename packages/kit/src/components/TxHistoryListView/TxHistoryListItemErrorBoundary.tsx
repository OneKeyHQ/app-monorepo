import { SizableText } from '@onekeyhq/components';

import { ErrorBoundaryBase } from '../ErrorBoundary';

class TxHistoryListItemErrorBoundary extends ErrorBoundaryBase {
  override render() {
    if (this.state.error) {
      return <SizableText>{this.state.error.message}</SizableText>;
    }
    return this.props.children;
  }
}

export { TxHistoryListItemErrorBoundary };
