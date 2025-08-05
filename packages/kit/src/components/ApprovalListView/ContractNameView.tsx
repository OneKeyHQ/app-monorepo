import { memo } from 'react';

import { useIntl } from 'react-intl';

import {
  type ISizableTextProps,
  SizableText,
  XStack,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import approvalUtils from '@onekeyhq/shared/src/utils/approvalUtils';

import { useContractMapAtom } from '../../states/jotai/contexts/approvalList';

type IProps = {
  address: string;
  networkId: string;
  nameStyleProps?: ISizableTextProps;
};

function ContractNameView(props: IProps) {
  const { address, networkId, nameStyleProps } = props;
  const intl = useIntl();

  const [{ contractMap }] = useContractMapAtom();

  const contract =
    contractMap[
      approvalUtils.buildContractMapKey({
        networkId,
        contractAddress: address,
      })
    ];

  return (
    <XStack alignItems="center" gap="$1">
      <SizableText size="$bodyMdMedium" {...nameStyleProps}>
        {contract?.label ||
          intl.formatMessage({ id: ETranslations.global_unknown })}
      </SizableText>
    </XStack>
  );
}

export default memo(ContractNameView);
