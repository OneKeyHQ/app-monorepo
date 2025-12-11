import { useIntl } from 'react-intl';

import { SizableText, XStack } from '@onekeyhq/components';
import type { IHistoryListSectionGroup } from '@onekeyhq/shared/types/history';

function TxHistorySectionHeader(props: IHistoryListSectionGroup) {
  const { title, titleKey, titleProps } = props;
  const intl = useIntl();
  const titleText = title || intl.formatMessage({ id: titleKey }) || '';
  return (
    <XStack px="$2">
      <SizableText color="$textSubdued" size="$headingXs" {...titleProps}>
        {titleText}
      </SizableText>
    </XStack>
  );
}
export { TxHistorySectionHeader };
