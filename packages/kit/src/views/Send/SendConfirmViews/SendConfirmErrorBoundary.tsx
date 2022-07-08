import { ErrorBoundaryBase } from '../../../components/ErrorBoundary';
import { Text } from '@onekeyhq/components';
import React from 'react';


export class SendConfirmErrorBoundary extends ErrorBoundaryBase {
  override render() {
    if (this.state.error) {
      return <Text>{this.state.error.message}</Text>;
    }
    return this.props.children;
  }
}
