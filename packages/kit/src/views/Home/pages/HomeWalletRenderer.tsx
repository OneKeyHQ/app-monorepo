import type { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

export interface IHomeWalletRendererProps {
  eligible: boolean;
  legacy: React.ReactNode;
  sceneName: EAccountSelectorSceneName;
}

export function HomeWalletRenderer({ legacy }: IHomeWalletRendererProps) {
  return legacy;
}
