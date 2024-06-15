import { useIntl } from 'react-intl';

import { SizableText, TextArea, YStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

function DAppSignMessageContent({ content }: { content: string }) {
  const intl = useIntl();
  return (
    <YStack justifyContent="center">
      <SizableText color="$text" size="$headingMd" mb="$2">
        {intl.formatMessage({ id: ETranslations.dapp_connect_message })}
      </SizableText>
      <TextArea value={content} editable={false} numberOfLines={14} />
    </YStack>
  );
}

export { DAppSignMessageContent };
