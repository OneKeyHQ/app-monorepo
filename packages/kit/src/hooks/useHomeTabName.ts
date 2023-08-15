import { WalletHomeTabEnum } from '../views/Wallet/type';

import { useAppSelector } from './useAppSelector';

export function useHomeTabName() {
  const currentHomeTabName = useAppSelector((s) => s.status.homeTabName);
  return currentHomeTabName || WalletHomeTabEnum.Tokens;
}
