import { useMemo } from 'react';

import { Divider, XStack, YStack } from '@onekeyhq/components';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { IEarnText, IEarnTooltip } from '@onekeyhq/shared/types/staking';

import { EarnText } from '../../Staking/components/ProtocolDetails/EarnText';
import { EarnTooltip } from '../../Staking/components/ProtocolDetails/EarnTooltip';
import { useBorrowContext } from '../BorrowProvider';

const OverviewItem = ({
  title,
  text,
  action,
  tooltip,
  needDivider,
}: {
  title: IEarnText;
  text: IEarnText;
  action?: React.ReactNode;
  tooltip?: IEarnTooltip;
  needDivider?: boolean;
}) => {
  return (
    <>
      <YStack>
        <EarnText text={title} size="$bodyMd" color="$textSubdued" />
        <EarnText text={text} size="$headingLg" color="$textText" />
        <EarnTooltip tooltip={tooltip} />
        {action}
      </YStack>
      {needDivider ? (
        <Divider bg="$headingSm" vertical mx="$6" height="$8" width="$1" />
      ) : null}
    </>
  );
};

export const Overview = () => {
  const { reserves } = useBorrowContext();
  const [settings] = useSettingsPersistAtom();
  const amountPlaceholder = useMemo(() => {
    return `${settings.currencyInfo.symbol}0.00`;
  }, [settings.currencyInfo.symbol]);

  // FIXME[Borrow]: i18n

  return (
    <XStack mt="$2" mb="$5" ai="center">
      <OverviewItem
        needDivider
        title={{ text: 'Net worth' }}
        text={
          reserves?.overview?.netWorth ?? {
            text: amountPlaceholder,
            color: '$textDisabled',
          }
        }
      />

      <OverviewItem
        needDivider
        title={{ text: 'Net APY' }}
        text={
          reserves?.overview?.netApy ?? { text: '-', color: '$textDisabled' }
        }
      />
      <OverviewItem
        needDivider
        title={{ text: 'Health factor' }}
        text={
          reserves?.overview?.healthFactor.text ?? {
            text: amountPlaceholder,
            color: '$textDisabled',
          }
        }
      />
      <OverviewItem
        title={{ text: 'Claimable rewards' }}
        text={
          reserves?.overview?.rewards.text ?? {
            text: amountPlaceholder,
            color: '$textDisabled',
          }
        }
      />
    </XStack>
  );
};
