export const TRAVEL_MODE_COPY = {
  title: 'Travel Mode',
  disabledSwitchDescription: 'Your wallet is ready to use',
  enabledSwitchDescription: 'Your wallet information is hidden',
  explanationTitle: 'What is Travel Mode?',
  description:
    'Hide your wallet information while you travel. Everything returns when you turn Travel Mode off.',
  details: [
    'Wallets, assets, and history stay hidden.',
    'New wallet activity is not saved.',
    'App connections, backups, and alerts stay paused.',
    'Your Passcode protection stays on.',
  ],
  enabledMessage: 'Travel Mode is on',
  enabledDescription:
    'Your wallets and activity will stay hidden until you turn it off.',
  enableConfirmationTitle: 'Turn on Travel Mode?',
  enableConfirmationDescription:
    'Your wallet will appear empty while Travel Mode is on. Don’t worry—nothing will be deleted. Everything will return after you turn it off.',
  enableConfirmationDetails:
    'Your wallets, balances, and transaction history will be hidden. Changes you make won’t be saved. Connections, backups, and wallet alerts will be paused.',
  enableConfirmationCancel: 'Not now',
  enableConfirmationConfirm: 'Turn on Travel Mode',
  restartingTitle: 'Restarting OneKey…',
  restartingDescription: 'Applying the new protection mode.',
} as const;
