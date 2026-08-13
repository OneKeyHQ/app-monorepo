import type { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

export type THomeWalletRendererEligibility =
  | 'pending'
  | 'eligible'
  | 'ineligible';

export interface IHomeWalletRendererProps {
  eligibility: THomeWalletRendererEligibility;
  legacy: React.ReactNode;
  sceneName: EAccountSelectorSceneName;
}

export function HomeWalletRenderer({ legacy }: IHomeWalletRendererProps) {
  return legacy;
}
