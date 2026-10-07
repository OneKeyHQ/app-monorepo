import { useMemo } from 'react';

import { Accordion } from '@onekeyhq/components';
import { useInviteCardStyle } from '@onekeyhq/kit/src/views/ReferFriends/pages/InviteReward/components/useInviteCardStyle';
import type { IInviteLevelDetail } from '@onekeyhq/shared/src/referralCode/type';

import { LevelAccordionItem } from './LevelAccordionItem';

export function LevelListSection({
  currentLevel,
  levels,
}: {
  currentLevel: number;
  levels: IInviteLevelDetail['levels'];
}) {
  const cardStyle = useInviteCardStyle();
  const displayLevels = useMemo(() => levels.toReversed(), [levels]);

  return (
    <Accordion type="single" collapsible overflow="hidden" {...cardStyle}>
      {displayLevels.map((level, index) => {
        const ascendingIndex = levels.length - 1 - index;
        const isHighestLevel = ascendingIndex === levels.length - 1;
        const isLowestLevel = ascendingIndex === 0;
        const retentionConditions = isLowestLevel
          ? undefined
          : levels[ascendingIndex - 1].upgradeConditions;
        const nextLevelLabel = isHighestLevel
          ? undefined
          : levels[ascendingIndex + 1]?.label;
        const isCurrent = level.level === currentLevel;

        return (
          <LevelAccordionItem
            key={level.level}
            level={level}
            isCurrent={isCurrent}
            isLast={index === displayLevels.length - 1}
            isHighestLevel={isHighestLevel}
            isLowestLevel={isLowestLevel}
            retentionConditions={retentionConditions}
            nextLevelLabel={nextLevelLabel}
          />
        );
      })}
    </Accordion>
  );
}
