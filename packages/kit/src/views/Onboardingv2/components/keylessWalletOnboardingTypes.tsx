import type { ReactNode } from 'react';

import type { ISecurityKeyType } from './SecurityKeyIcon';

export enum ECreationStepState {
  Idle = 'idle',
  InProgress = 'inProgress',
  Info = 'info',
  Success = 'success',
  Error = 'error',
}

export enum ECreationStepId {
  DeviceShare = 'device-share',
  CloudShare = 'cloud-share',
  AuthShare = 'auth-share',
}

export interface ICreationStep {
  id: ECreationStepId;
  securityKeyType: ISecurityKeyType | undefined;
  title: string | undefined;
  description?: ReactNode;
  state: ECreationStepState | undefined;
  infoMessage?: string;
}
