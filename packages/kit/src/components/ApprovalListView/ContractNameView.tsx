import { memo } from 'react';

import {
  type ISizableTextProps,
  SizableText,
  XStack,
} from '@onekeyhq/components';

import { useContractMapAtom } from '../../states/jotai/contexts/approvalList';

type IProps = {
  address: string;
  nameStyleProps?: ISizableTextProps;
};

function ContractNameView(props: IProps) {
  const { address, nameStyleProps } = props;

  const [{ contractMap }] = useContractMapAtom();

  const contract = contractMap[address];

  return (
    <XStack alignItems="center" gap="$1">
      <SizableText size="$bodyMdMedium" {...nameStyleProps}>
        {contract?.label}
      </SizableText>
    </XStack>
  );
}

export default memo(ContractNameView);
