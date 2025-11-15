import { useMemo } from 'react';

import { Accordion } from '@onekeyhq/components';
import type { IInviteLevelDetail } from '@onekeyhq/shared/src/referralCode/type';

import { LevelAccordionItem } from './LevelAccordionItem';

export function LevelListSection({
  levels,
}: {
  levels: IInviteLevelDetail['levels'];
}) {
  const defaultValue = useMemo(() => {
    const currentLevel = levels.find((level) => level.isCurrent);
    return currentLevel ? `level-${currentLevel.level}` : undefined;
  }, [levels]);

  return (
    <Accordion
      type="single"
      collapsible
      defaultValue={defaultValue}
      borderWidth={1}
      borderColor="$borderSubdued"
      borderRadius="$3"
      borderCurve="continuous"
      overflow="hidden"
    >
      {levels.map((level, index) => (
        <LevelAccordionItem
          key={level.level}
          level={level}
          isCurrent={level.isCurrent}
          isFirst={index === 0}
          isLast={index === levels.length - 1}
        />
      ))}
    </Accordion>
  );
}
