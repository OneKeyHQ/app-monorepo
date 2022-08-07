export const ONBOARDING_PROCESS_INFO_LIST = [
  {
    text: 'content__creating_your_wallet',
  },
  {
    text: 'content__generating_your_accounts',
  },
  {
    text: 'content__encrypting_your_data',
  },
  // {
  //   text: 'content__backing_up_to_icloud',
  // },
];

// export const ONBOARDING_PROCESS_DELAY = 5000; // creating faster than animation
// export const ONBOARDING_PROCESS_DELAY = 0; // creating slower than animation
export const ONBOARDING_PROCESS_DELAY = 1000;
// export const ONBOARDING_PROCESS_DELAY = 3000;

export const ONBOARDING_CREATED_EVENT_NAME = 'event-wallet-created';

export const ONBOARDING_PAUSED_INDEX_HARDWARE = 1;
export const ONBOARDING_PAUSED_INDEX_SOFTWARE = 1;

export const ONBOARDING_WEBVIEW_METHODS = {
  onboardingWalletCreated: 'onboardingWalletCreated',
  onboardingPressFinishButton: 'onboardingPressFinishButton',
};
