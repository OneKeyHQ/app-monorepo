import { useIntl } from 'react-intl';

import { Button, Heading, XStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

export function DappSearchModalSectionHeader({
  title,
  onMorePress,
}: {
  title: string;
  onMorePress: () => void;
}) {
  const intl = useIntl();
  return (
    <XStack px="$5" pb="$2" alignItems="center" justifyContent="space-between">
      <Heading size="$headingMd">{title}</Heading>
      <Button variant="tertiary" size="medium" onPress={onMorePress}>
        {intl.formatMessage({ id: ETranslations.explore_see_all })}
      </Button>
    </XStack>
  );
}
