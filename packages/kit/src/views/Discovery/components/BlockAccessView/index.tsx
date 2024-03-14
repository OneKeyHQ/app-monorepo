import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Empty, YStack } from '@onekeyhq/components';

function BlockAccessView({ onCloseTab }: { onCloseTab: () => void }) {
  const intl = useIntl();
  const content = useMemo(
    () => (
      <YStack
        fullscreen
        bg="$bgApp"
        justifyContent="center"
        alignItems="center"
        animation="quick"
      >
        <Empty
          icon="ErrorOutline"
          title="Connection is Not Private"
          description="Only supports HTTPS protocol! Unsafe website is vulnerable to attacks and forgery. "
          buttonProps={{
            children: intl.formatMessage({ id: 'form__close_tab' }),
            onPress: onCloseTab,
          }}
        />
      </YStack>
    ),
    [onCloseTab, intl],
  );
  return content;
}

export default BlockAccessView;
