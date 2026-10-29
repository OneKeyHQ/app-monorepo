import { useIntl } from 'react-intl';

import { Icon, SizableText, XStack, YStack } from '@onekeyhq/components';
import type { IKeyOfIcons } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { EarnTestIDs } from '../testIDs';

function EarnHomeShortcut({
  icon,
  label,
  testID,
  onPress,
}: {
  icon: IKeyOfIcons;
  label: string;
  testID: string;
  onPress?: () => void;
}) {
  return (
    <YStack
      testID={testID}
      role={onPress ? 'button' : undefined}
      // OK-60104: the tile used to be pinned to the design's 73.667pt, which
      // only ever fit the English labels — the Portuguese "Loans" needs ~82pt
      // and was cut off mid-word with an ellipsis. Splitting the row into
      // thirds gives each label ~117pt without touching the type scale, and the
      // labels stay centered on their own third. Web reads flex 1 with an
      // auto basis, which sizes each tile to its label; a zero basis keeps
      // the thirds equal there too.
      flex={1}
      flexBasis={0}
      gap="$1"
      ai="center"
      jc="center"
      cursor={onPress ? 'pointer' : undefined}
      userSelect="none"
      pressStyle={onPress ? { opacity: 0.5 } : undefined}
      onPress={onPress}
    >
      <YStack p="$1.5" borderRadius="$3" bg="$bgSubdued">
        <Icon name={icon} size="$6" color="$iconStrong" />
      </YStack>
      <SizableText
        w="100%"
        size="$headingSm"
        letterSpacing={-0.15}
        textAlign="center"
        numberOfLines={1}
      >
        {label}
      </SizableText>
    </YStack>
  );
}

export function EarnHomeShortcuts({
  onOpenLoans,
  onOpenTokens,
  onOpenEarn,
  onOpenProtocols,
}: {
  onOpenLoans: () => void;
  onOpenTokens: () => void;
  // Where given, the first tile is Earn: the deposit window on the wallet's
  // tokens, in place of the token list (demo 10-29)
  onOpenEarn?: () => void;
  onOpenProtocols: () => void;
}) {
  const intl = useIntl();
  return (
    <XStack px="$pagePadding" pb="$5" jc="space-between">
      {onOpenEarn ? (
        <EarnHomeShortcut
          icon="DollarOutline"
          label={intl.formatMessage({ id: ETranslations.earn_title })}
          testID={EarnTestIDs.homeShortcut('earn')}
          onPress={onOpenEarn}
        />
      ) : (
        <EarnHomeShortcut
          icon="DollarOutline"
          label={intl.formatMessage({ id: ETranslations.earn_tokens__title })}
          testID={EarnTestIDs.homeShortcut('tokens')}
          onPress={onOpenTokens}
        />
      )}
      <EarnHomeShortcut
        icon="HandCoinsOutline"
        label={intl.formatMessage({ id: ETranslations.earn_loans__action })}
        testID={EarnTestIDs.borrowEntryButton}
        onPress={onOpenLoans}
      />
      <EarnHomeShortcut
        icon="FileTextOutline"
        label={intl.formatMessage({ id: ETranslations.earn_protocols__title })}
        testID={EarnTestIDs.homeShortcut('protocols')}
        onPress={onOpenProtocols}
      />
    </XStack>
  );
}
