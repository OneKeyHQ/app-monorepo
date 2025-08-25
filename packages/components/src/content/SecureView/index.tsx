import type { ComponentType } from 'react';

import { OptimizationView } from '../../optimization/View';

import type { ISecureViewProps } from './type';

const SecureView =
  OptimizationView as unknown as ComponentType<ISecureViewProps>;

export { SecureView };
export * from './type';
