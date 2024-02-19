import type { ComponentProps } from 'react';
import { memo } from 'react';

import { Stack } from '@onekeyhq/components';
import { AccountSelectorActiveAccountHome } from '@onekeyhq/kit/src/components/AccountSelector';
import { DeriveTypeSelectorTrigger } from '@onekeyhq/kit/src/components/AccountSelector/DeriveTypeSelectorTrigger';
import { NetworkSelectorTriggerHome } from '@onekeyhq/kit/src/components/AccountSelector/NetworkSelectorTrigger';

type IProps = ComponentProps<typeof Stack>;

function HomeSelector(props: IProps) {
  const num = 0;

  return (
    <Stack alignItems="center" space="$1" flexDirection="row" {...props}>
      <NetworkSelectorTriggerHome num={num} />
      <AccountSelectorActiveAccountHome num={num} />
      <DeriveTypeSelectorTrigger miniMode num={num} />
    </Stack>
  );
}

export default memo(HomeSelector);
