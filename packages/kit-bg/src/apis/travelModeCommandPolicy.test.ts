import {
  isTravelModeRecoveryServiceCall,
  shouldRejectTravelModeServiceCall,
} from './travelModeCommandPolicy';

describe('travelModeCommandPolicy', () => {
  it.each([
    ['serviceDApp', 'getConnectedAccounts'],
    ['serviceWalletConnect', 'connectToDapp'],
    ['walletConnect', 'connectToDapp'],
    ['serviceCloudBackup', 'backup'],
    ['serviceAccount', 'createHDWallet'],
    ['serviceAccount', 'generateMnemonic'],
    ['serviceBatchCreateAccount', 'startBatchCreateAccountsFlow'],
    ['serviceSend', 'sendTransaction'],
    ['serviceNetwork', 'exportAccountKeys'],
    ['serviceHyperliquidExchange', 'placeOrder'],
    ['serviceInternalSignAndVerify', 'verifyMessage'],
    ['serviceUnifoldDeposit', 'claimDepositSessionTracking'],
    ['serviceV4Migration', 'getMigrationPayload'],
    ['servicePassword', 'updatePassword'],
    ['serviceApp', 'resetApp'],
    ['serviceAccount', 'runFutureAssetMutation'],
    ['serviceAccount', 'getOrCreateAccount'],
    ['serviceSend', 'validateAndSendTransaction'],
    ['serviceTransaction', 'simulateAndBroadcastTransaction'],
    ['serviceReferralCode', 'autoSignBoundReferralCodeMessageByHDWallet'],
    ['serviceHyperliquidReferral', 'submitSetReferrerWithSignature'],
    ['serviceWebviewPerp', 'approveBuilderFeeIfRequired'],
    ['serviceToken', 'createBinancePreOrder'],
    ['serviceFutureFeature', 'signFutureAssetCommand'],
    ['serviceFutureFeature', 'submitPreparedSignature'],
    ['serviceSetting', 'setBiologyAuthSwitchOn'],
    ['serviceSetting', 'setEnableMenuBarTray'],
    ['serviceNetwork', 'getNetwork'],
    ['serviceOnboarding', 'createWallet'],
    ['serviceOnboarding', 'isOnboardingDone'],
    ['serviceFutureFeature', 'getFutureBusinessData'],
    ['', 'emitEvent'],
    ['serviceUnknown', 'unknownMethod'],
    ['mobile@nested@serviceTravelMode', 'setEnabled'],
    ['@serviceTravelMode', 'setEnabled'],
    ['mobile@', 'setEnabled'],
  ])('rejects %s.%s', (serviceName, methodName) => {
    expect(shouldRejectTravelModeServiceCall({ methodName, serviceName })).toBe(
      true,
    );
  });

  it.each([
    ['serviceTravelMode', 'requestPageAdmission'],
    ['serviceTravelMode', 'enterPage'],
    ['serviceTravelMode', 'leavePage'],
    ['serviceTravelMode', 'setEnabled'],
    ['serviceTravelMode', 'retryRestart'],
    ['servicePassword', 'encodeSensitiveText'],
    ['servicePassword', 'lockApp'],
    ['servicePassword', 'unLockApp'],
    ['servicePassword', 'checkLockStatus'],
    ['servicePassword', 'promptPasswordVerify'],
    ['servicePassword', 'verifyPassword'],
    ['servicePassword', 'waitPasswordEncryptorReady'],
    ['servicePassword', 'resolvePasswordPromptDialog'],
    ['servicePassword', 'rejectPasswordPromptDialog'],
    ['servicePassword', 'cancelPasswordPromptDialog'],
    ['servicePassword', 'resetPasswordStatus'],
    ['servicePassword', 'setAppLockDuration'],
    ['servicePassword', 'setEnableSystemIdleLock'],
    ['serviceSetting', 'setCurrency'],
    ['serviceSetting', 'setHapticFeedbackEnabled'],
    ['serviceSetting', 'setLocale'],
    ['serviceSetting', 'setTheme'],
    ['serviceSetting', 'refreshLastActivity'],
    ['serviceApp', 'isAppLocked'],
    ['serviceApp', 'restartApp'],
    ['', 'getAtomStates'],
    ['', 'setAtomValue'],
  ])('allows %s.%s', (serviceName, methodName) => {
    expect(shouldRejectTravelModeServiceCall({ methodName, serviceName })).toBe(
      false,
    );
  });

  it('normalizes namespaced service names', () => {
    expect(
      shouldRejectTravelModeServiceCall({
        methodName: 'createAccount',
        serviceName: 'evm@serviceAccount',
      }),
    ).toBe(true);
  });

  it('does not widen the control plane for namespaced services', () => {
    expect(
      shouldRejectTravelModeServiceCall({
        methodName: 'setEnabled',
        serviceName: 'mobile@serviceTravelMode',
      }),
    ).toBe(false);
    expect(
      shouldRejectTravelModeServiceCall({
        methodName: 'getStatusForFutureFeature',
        serviceName: 'mobile@serviceTravelMode',
      }),
    ).toBe(true);
  });

  it('limits transition recovery to the exact restart retry command', () => {
    expect(
      isTravelModeRecoveryServiceCall({
        methodName: 'retryRestart',
        serviceName: 'mobile@serviceTravelMode',
      }),
    ).toBe(true);
    expect(
      isTravelModeRecoveryServiceCall({
        methodName: 'requestPageAdmission',
        serviceName: 'serviceTravelMode',
      }),
    ).toBe(false);
    expect(
      isTravelModeRecoveryServiceCall({
        methodName: 'restartApp',
        serviceName: 'serviceApp',
      }),
    ).toBe(false);
  });
});
