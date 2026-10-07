import { useMemo } from 'react';

import { SizableText } from '@onekeyhq/components';
import type { IInviteLevelDetail } from '@onekeyhq/shared/src/referralCode/type';

import { useCurrentLevelCardFromDetail } from './CurrentLevelCard/hooks/useCurrentLevelCard';
import {
  getInviteValueLine,
  selectInviteValueLineItems,
} from './getInviteValueLine';

import type { ICurrentLevelCardProps } from './CurrentLevelCard/types';

export function InviteValueLine({
  levelDetail,
  ...props
}: ICurrentLevelCardProps & { levelDetail: IInviteLevelDetail | undefined }) {
  const { commissionRates } = useCurrentLevelCardFromDetail(props, levelDetail);
  const line = useMemo(() => {
    const items = selectInviteValueLineItems({
      commissionRates: commissionRates.map((item) => ({
        subject: item.subject,
        you: item.rate.you,
        enabled: item.rate.enabled,
      })),
      configs: props.rebateConfig.configs,
    });
    return getInviteValueLine(items);
  }, [commissionRates, props.rebateConfig.configs]);

  if (!line) {
    return null;
  }

  return (
    <SizableText size="$bodyMd" color="$textSubdued">
      {line}
    </SizableText>
  );
}
