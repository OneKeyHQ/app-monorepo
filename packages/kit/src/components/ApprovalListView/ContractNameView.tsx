import { memo } from 'react';

import { useIntl } from 'react-intl';

import {
  Badge,
  type ISizableTextProps,
  SizableText,
  XStack,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IAddressInfo } from '@onekeyhq/shared/types/address';

import { useApprovalListViewContext } from './ApprovalListViewContext';

type IProps = {
  address: string;
  networkId: string;
  nameStyleProps?: ISizableTextProps;
  isRiskContract?: boolean;
  isInactiveApproval?: boolean;
  contract?: IAddressInfo;
};

function ContractNameView(props: IProps) {
  const { nameStyleProps, isInactiveApproval, isRiskContract, contract } =
    props;

  const { hideRiskBadge } = useApprovalListViewContext();

  const intl = useIntl();

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
