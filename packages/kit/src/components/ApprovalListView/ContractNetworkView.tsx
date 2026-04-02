import { memo } from 'react';

import type { ISizableTextProps } from '@onekeyhq/components';
import { SizableText } from '@onekeyhq/components';

import { useAccountData } from '../../hooks/useAccountData';

type IProps = {
  networkId: string;
  networkStyleProps?: ISizableTextProps;
};

function ContractNetworkView(props: IProps) {
  const { networkId, networkStyleProps } = props;

  const { network } = useAccountData({ networkId });

  return (
    <SizableText size="$bodyMd" color="$textSubdued" {...networkStyleProps}>
      {network?.name}
    </SizableText>
  );
}

export default memo(ContractNetworkView);
