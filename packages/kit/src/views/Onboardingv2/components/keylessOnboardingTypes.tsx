import type { MutableRefObject, ReactNode } from 'react';

import type { ECloudBackupProviderType } from '@onekeyhq/shared/src/cloudBackup/cloudBackupTypes';
import type {
  IAuthKeyPack,
  ICloudKeyPack,
  IDeviceKeyPack,
  IKeylessWalletPacks,
  IKeylessWalletRestoredData,
} from '@onekeyhq/shared/src/keylessWallet/keylessWalletTypes';
import type { EOnboardingV2KeylessWalletCreationMode } from '@onekeyhq/shared/src/routes/onboardingv2';

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

export type IKeylessShareCardsRefs = {
  generatedPacks: IKeylessWalletPacks | null;
  isGeneratingPacks: boolean;
  packSetIds: {
    device: string | null;
    cloud: string | null;
    auth: string | null;
  };
  restorePacks: {
    device: IDeviceKeyPack | null;
    cloud: ICloudKeyPack | null;
    auth: IAuthKeyPack | null;
  };
  restoreValidationResult: IKeylessWalletRestoredData | undefined;
};

export type IKeylessShareCardsCardContextValue = {
  mode: EOnboardingV2KeylessWalletCreationMode;
  refs: MutableRefObject<IKeylessShareCardsRefs>;
  cloudProviderType: ECloudBackupProviderType | undefined;
  handleSaveShare: (params: {
    stepId: ECreationStepId;
    shouldMoveToNextStep?: boolean;
    fn: (params: { generatedPacks: IKeylessWalletPacks }) => Promise<void | {
      devicePackSetId: string | undefined;
      cloudPackSetId: string | undefined;
      authPackSetId: string | undefined;
    }>;
  }) => Promise<void>;
  handleRestoreOrCheckShare: (params: {
    stepId: ECreationStepId;
    restoreTarget: 'device' | 'cloud' | 'auth';
    fn: () => Promise<{
      pack: IDeviceKeyPack | ICloudKeyPack | IAuthKeyPack;
      packSetId: string;
    }>;
  }) => Promise<void>;
};

export interface ICreationStep {
  id: ECreationStepId;
  state: ECreationStepState | undefined;
  infoMessage?: string;
}

export type IKeylessShareCardRuntimeStep = ICreationStep;
export type IKeylessShareCardProps = {
  step: IKeylessShareCardRuntimeStep;
  index: number;
  isLastStep: boolean;
};

export interface IKeylessKeyStepCardProps {
  step: ICreationStep;
  securityKeyType: ISecurityKeyType | undefined;
  title: string | undefined;
  description?: ReactNode;
  index: number;
  isLastStep: boolean;
  onStepAction: () => void;
  buttonText: string;
  onSecondaryAction?: () => void;
  secondaryButtonText?: string;
  mode: EOnboardingV2KeylessWalletCreationMode;
}

export interface IKeylessShareCardsViewProps {
  mode: EOnboardingV2KeylessWalletCreationMode;
}

export type IKeylessShareCardsEffectsProps = {
  isCreationComplete: boolean;
  isViewMode: boolean;
  handleCompleteSetup: () => Promise<void>;
  isRestoreOrViewMode: boolean;
  generatePacks: () => Promise<IKeylessWalletPacks>;
  refs: MutableRefObject<IKeylessShareCardsRefs>;
  isRestoreMode: boolean;
  handleRestoreOrCheckShare: IKeylessShareCardsCardContextValue['handleRestoreOrCheckShare'];
};
