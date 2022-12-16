import { Text } from '@onekeyhq/components';

import { ErrorBoundaryBase } from '../../../components/ErrorBoundary';

// TODO TxActionErrorBoundaryT0, TxActionErrorBoundaryT1
class TxActionErrorBoundary extends ErrorBoundaryBase {
  override render() {
    if (this.state.error) {
      return <Text>{this.state.error.message}</Text>;
    }
    return this.props.children;
  }
}

export { TxActionErrorBoundary };
