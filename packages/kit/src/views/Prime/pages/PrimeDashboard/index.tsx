import { memo } from 'react';
import type { ComponentProps } from 'react';

import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import PrimeDashboard from './PrimeDashboard';

type IPrimeDashboardProps = ComponentProps<typeof PrimeDashboard>;

const PrimeDashboardWithProvider = memo((props: IPrimeDashboardProps) => (
  <AccountSelectorProviderMirror
    config={{
      sceneName: EAccountSelectorSceneName.home,
    }}
    enabledNum={[0]}
  >
    <PrimeDashboard {...props} />
  </AccountSelectorProviderMirror>
));

PrimeDashboardWithProvider.displayName = 'PrimeDashboardWithProvider';

export default PrimeDashboardWithProvider;
