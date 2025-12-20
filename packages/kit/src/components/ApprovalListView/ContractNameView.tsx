import { memo } from 'react';

import { useIntl } from 'react-intl';

import {
  Badge,
  type ISizableTextProps,
  SizableText,
  XStack,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import approvalUtils from '@onekeyhq/shared/src/utils/approvalUtils';

import { useContractMapAtom } from '../../states/jotai/contexts/approvalList';

import { useApprovalListViewContext } from './ApprovalListViewContext';

type IProps = {
  address: string;
  networkId: string;
  nameStyleProps?: ISizableTextProps;
  isRiskContract?: boolean;
  isInactiveApproval?: boolean;
};

function ContractNameView(props: IProps) {
  const {
    address,
    networkId,
    nameStyleProps,
    isInactiveApproval,
    isRiskContract,
  } = props;

  const { hideRiskBadge } = useApprovalListViewContext();

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
      <SizableText size="$bodyLgMedium" {...nameStyleProps} numberOfLines={1}>
        {contract?.label ||
          intl.formatMessage({ id: ETranslations.global_unknown })}
      </SizableText>
      {isRiskContract && !hideRiskBadge ? (
        <Badge badgeSize="sm" badgeType="critical">
          <Badge.Text>
            {intl.formatMessage({ id: ETranslations.global_risk })}
          </Badge.Text>
        </Badge>
      ) : null}
      {isInactiveApproval && !hideRiskBadge ? (
        <Badge badgeSize="sm" badgeType="warning">
          <Badge.Text>
            {intl.formatMessage({ id: ETranslations.global_inactive })}
          </Badge.Text>
        </Badge>
      ) : null}
    </XStack>
  );
}

export default memo(ContractNameView);
