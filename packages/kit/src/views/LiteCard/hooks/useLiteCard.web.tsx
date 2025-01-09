import { useMemo } from 'react';

const backupWallet = () => {
  console.log('useLiteCard backupWallet is mock at web platform.');
};

const importWallet = () => {
  console.log('useLiteCard.importWallet is mock at web platform.');
};

const changePIN = () => {
  console.log('useLiteCard.changePIN is mock at web platform.');
};

const reset = () => {
  console.log('useLiteCard.reset is mock at web platform.');
};

export default function useLiteCard() {
  return useMemo(
    () => ({
      backupWallet,
      importWallet,
      changePIN,
      reset,
    }),
    [],
  );
}
