import { useIntl } from 'react-intl';
import { XStack } from 'tamagui';

import { Text } from '@onekeyhq/components';
import type { IHistoryListSectionGroup } from '@onekeyhq/shared/types/history';

function TxHistorySectionHeader(props: IHistoryListSectionGroup) {
  const { title, titleKey } = props;
  const intl = useIntl();
  const titleText = title || intl.formatMessage({ id: titleKey }) || '';
  return (
    <XStack>
      <Text color="$textSubdued">{titleText}</Text>
    </XStack>
  );
}
export { TxHistorySectionHeader };
