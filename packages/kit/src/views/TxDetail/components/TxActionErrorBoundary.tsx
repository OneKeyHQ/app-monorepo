import React from 'react';

import { Box, Text, Typography } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { ErrorBoundaryBase } from '../../../components/ErrorBoundary';

import { TxDetailActionBox } from './TxDetailActionBox';

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
