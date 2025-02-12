import RNFingerprintChange from 'react-native-fingerprint-change';

import type { ICheckBiometricAuthChanged } from './type';

export const checkBiometricAuthChanged: ICheckBiometricAuthChanged = () =>
  new Promise((resolve, reject) => {
    console.log('RNFingerprintChange', RNFingerprintChange)
    RNFingerprintChange.hasFingerPrintChanged(
      (error) => {
        reject(error);
      },
      (fingerprintHasChanged) => {
        console.log('--fingerprintHasChanged', fingerprintHasChanged);
        resolve(fingerprintHasChanged);
      },
    );
  });

export * from './type';
