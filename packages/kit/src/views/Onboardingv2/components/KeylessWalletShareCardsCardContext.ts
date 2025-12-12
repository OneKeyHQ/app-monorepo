import type { MutableRefObject } from 'react';
import { createContext, useContext } from 'react';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type {
  IAuthKeyPack,
  ICloudKeyPack,
  IDeviceKeyPack,
  IKeylessWalletPacks,
  IKeylessWalletRestoredData,
} from '@onekeyhq/shared/src/keylessWallet/keylessWalletTypes';
import type { EOnboardingV2KeylessWalletCreationMode } from '@onekeyhq/shared/src/routes/onboardingv2';

import type {
  ECreationStepId,
  ICreationStep,
} from './keylessWalletOnboardingTypes';

export type IKeylessWalletShareCardsRefs = {
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

export type IKeylessWalletShareCardsCardContextValue = {
  mode: EOnboardingV2KeylessWalletCreationMode;
  refs: MutableRefObject<IKeylessWalletShareCardsRefs>;
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

export const KeylessWalletShareCardsCardContext =
  createContext<IKeylessWalletShareCardsCardContextValue | null>(null);

export function useKeylessWalletShareCardsCardContext() {
  const ctx = useContext(KeylessWalletShareCardsCardContext);
  if (!ctx) {
    throw new OneKeyLocalError('KeylessWalletShareCardsCardContext not found');
  }
  return ctx;
}

export type IKeylessWalletShareCardRuntimeStep = Pick<
  ICreationStep,
  'id' | 'state' | 'infoMessage'
>;

export type IKeylessWalletShareCardProps = {
  step: IKeylessWalletShareCardRuntimeStep;
  index: number;
  isLastStep: boolean;
};
