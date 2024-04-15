import { SecureWindow } from '@bufgix/react-native-secure-window';

import type { ISecureViewProps } from './type';

export function SecureView({ children }: ISecureViewProps) {
  return <SecureWindow>{children}</SecureWindow>;
}

export * from './type';
