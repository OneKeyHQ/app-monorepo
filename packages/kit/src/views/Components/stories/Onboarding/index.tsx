import React, { useState } from 'react';

import { ScrollView, useIsVerticalLayout } from '@onekeyhq/components';
import { useSafeAreaInsets } from '@onekeyhq/components/src/Provider/hooks';

import BehindTheScene from './BehindTheScene';
import ConnectWallet from './ConnectWallet';
import Drawer from './Drawer';
import ImportWallet from './ImportWallet';
import RecoveryPhrase from './RecoveryPhrase';
import SetPassword from './SetPassword';
import ShowRecoveryPhrase from './ShowRecoveryPhrase';
import Welcome from './Welcome';

const OnboardingGallery = () => {
  const insets = useSafeAreaInsets();
  const isVerticalLayout = useIsVerticalLayout();

  const [isWelcomeView, setIsWelcomeView] = useState(true);
  const [isImportWalletView, setIsImportWalletView] = useState(false);
  const [isSetPasswordView, setIsSetPasswordView] = useState(false);
  const [isConnectWalletView, setIsConnectWalletView] = useState(false);
  const [isRecoveryPhraseView, setIsRecoveryPhraseView] = useState(false);
  const [isShowRecoveryPhraseView, setIsShowRecoveryPhraseView] =
    useState(false);
  const [isShowBehindTheSceneView, setIsShowBehindTheSceneView] =
    useState(false);
  const [isShowDrawer, setIsShowDrawer] = useState(false);

  const handleCreateWallet = () => {
    setIsWelcomeView(false);
    setIsSetPasswordView(true);
  };

  const handleImportWallet = () => {
    setIsWelcomeView(false);
    setIsImportWalletView(true);
  };

  const handleConnectWallet = () => {
    setIsWelcomeView(false);
    setIsConnectWalletView(true);
  };

  const handleConfirmPassword = () => {
    setIsSetPasswordView(false);
    setIsRecoveryPhraseView(true);
  };

  const handleShowRecoveryPhrase = () => {
    setIsRecoveryPhraseView(false);
    setIsShowRecoveryPhraseView(true);
  };

  const handleShowBehindTheScene = () => {
    if (isVerticalLayout) {
      setIsShowRecoveryPhraseView(false);
    } else {
      setIsRecoveryPhraseView(false);
    }
    setIsShowBehindTheSceneView(true);
  };

  const handleImportWalletBack = () => {
    setIsImportWalletView(false);
    setIsWelcomeView(true);
  };

  const handleSetPasswordBack = () => {
    setIsSetPasswordView(false);
    setIsWelcomeView(true);
  };

  const handleConnectWalletBack = () => {
    setIsConnectWalletView(false);
    setIsWelcomeView(true);
  };

  const handleRecoveryPhraseBack = () => {
    setIsRecoveryPhraseView(false);
    setIsSetPasswordView(true);
  };

  const handleShowRecoveryPhraseBack = () => {
    setIsShowRecoveryPhraseView(false);
    setIsRecoveryPhraseView(true);
  };

  return (
    <ScrollView
      flex={1}
      _contentContainerStyle={{
        flex: {
          base:
            isShowRecoveryPhraseView || isRecoveryPhraseView ? 1 : undefined,
          sm: 1,
        },
        justifyContent: 'center',
        alignItems: 'center',
        px: 6,
        pt: 4 + insets.top,
        pb: 4 + insets.bottom,
        bgColor: 'background-default',
      }}
    >
      {isWelcomeView ? (
        <Welcome
          onPressCreateWallet={handleCreateWallet}
          onPressImportWallet={handleImportWallet}
          onPressConnectWallet={handleConnectWallet}
          visible={isWelcomeView}
        />
      ) : undefined}
      {isImportWalletView ? (
        <ImportWallet
          onPressBackButton={handleImportWalletBack}
          visible={isImportWalletView}
          onPressDrawerTrigger={() => {
            setIsShowDrawer(true);
          }}
        />
      ) : undefined}
      {isSetPasswordView ? (
        <SetPassword
          onPressBackButton={handleSetPasswordBack}
          onPressConfirmButton={handleConfirmPassword}
          visible={isSetPasswordView}
        />
      ) : undefined}
      {isConnectWalletView ? (
        <ConnectWallet
          onPressBackButton={handleConnectWalletBack}
          visible={isConnectWalletView}
        />
      ) : undefined}
      {isRecoveryPhraseView ? (
        <RecoveryPhrase
          visible={isRecoveryPhraseView}
          onPressBackButton={handleRecoveryPhraseBack}
          onPressShowPhraseButton={handleShowRecoveryPhrase}
          onPressSavedPhrase={handleShowBehindTheScene}
        />
      ) : undefined}
      {isShowRecoveryPhraseView ? (
        <ShowRecoveryPhrase
          visible={isShowRecoveryPhraseView}
          onPressBackButton={handleShowRecoveryPhraseBack}
          onPressSavedPhrase={handleShowBehindTheScene}
        />
      ) : undefined}
      {isShowBehindTheSceneView ? (
        <BehindTheScene visible={isShowBehindTheSceneView} />
      ) : undefined}

      <Drawer
        visible={isShowDrawer}
        onClose={() => {
          setIsShowDrawer(false);
        }}
      />
    </ScrollView>
  );
};

export default OnboardingGallery;
