import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Empty, YStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
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
      return intl.formatMessage({
        id: ETranslations.explore_risky_domain,
      });
    }
    return intl.formatMessage({
      id: ETranslations.explore_connection_is_not_private,
    });
  }, [urlValidateState, intl]);
  const description = useMemo(() => {
    if (urlValidateState === EValidateUrlEnum.InvalidPunycode) {
      return intl.formatMessage({
        id: ETranslations.explore_risky_domain_warning,
      });
    }
    return intl.formatMessage({
      id: ETranslations.explore_connection_is_not_private_warning,
    });
  }, [urlValidateState, intl]);
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
            children: intl.formatMessage({
              id: ETranslations.explore_close_tab,
            }),
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
