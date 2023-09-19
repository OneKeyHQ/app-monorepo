import { Text } from '@onekeyhq/components';

import { ErrorBoundaryBase } from '../../../components/ErrorBoundary';

export class SendConfirmErrorBoundary extends ErrorBoundaryBase {
  override render() {
    if (this.state.error) {
      return <Text>{this.state.error.message}</Text>;
    }
    return this.props.children;
  }
}
