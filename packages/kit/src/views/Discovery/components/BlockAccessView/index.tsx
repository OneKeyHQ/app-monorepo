import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Empty, YStack } from '@onekeyhq/components';
import { EValidateUrlEnum } from '@onekeyhq/shared/types/dappConnection';

function BlockAccessView({
  urlValidateState,
  onCloseTab,
}: {
  urlValidateState: EValidateUrlEnum | undefined;
  onCloseTab: () => void;
}) {
  const intl = useIntl();
  const title = useMemo(() => {
    if (urlValidateState === EValidateUrlEnum.InvalidPunycode) {
      return 'Risky domain';
    }
    return 'Connection is Not Private';
  }, [urlValidateState]);
  const description = useMemo(() => {
    if (urlValidateState === EValidateUrlEnum.InvalidPunycode) {
      return 'Possibly a fake website.Attackers sometimes make subtle, undetectable changes to URLs to impersonate websites.';
    }
    return 'Only supports HTTPS protocol! Unsafe website is vulnerable to attacks and forgery. ';
  }, [urlValidateState]);
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
          title={title}
          description={description}
          buttonProps={{
            children: intl.formatMessage({ id: 'form__close_tab' }),
            onPress: onCloseTab,
          }}
        />
      </YStack>
    ),
    [onCloseTab, intl, title, description],
  );
  return content;
}

export default BlockAccessView;
