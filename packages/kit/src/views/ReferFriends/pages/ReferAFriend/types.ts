import type { IInvitePostConfig } from '@onekeyhq/shared/src/referralCode/type';

// Phase state enum for the refer a friend page
export enum EPhaseState {
  next = 'next',
  join = 'join',
}

// Props for the main ReferAFriendPage component
export interface IReferAFriendPageProps {
  postConfig: IInvitePostConfig;
}

// Props for the intro phase component
export interface IReferAFriendIntroPhaseProps {
  postConfig: IInvitePostConfig;
}

// Props for the how-to phase component
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface IReferAFriendHowToPhaseProps {
  // Currently no specific props needed, but keeping interface for consistency
}

// Props for the IntroStepLine component
export interface IIntroStepLineProps {
  no: number;
  description: string;
}
