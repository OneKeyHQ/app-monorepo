import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Empty, YStack } from '@onekeyhq/components';
import { ANIMATE_ONLY_OPACITY } from '@onekeyhq/components/src/utils/animationConstants';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import uriUtils from '@onekeyhq/shared/src/utils/uriUtils';
import { EValidateUrlEnum } from '@onekeyhq/shared/types/dappConnection';

function BlockAccessView({
  url,
  urlValidateState,
  onCloseTab,
}: {
  url?: string;
  urlValidateState: EValidateUrlEnum | undefined;
  onCloseTab: () => void;
}) {
  const intl = useIntl();
  const isLocalUrlBlocked = useMemo(
    () =>
      urlValidateState === EValidateUrlEnum.NotSupportProtocol &&
      Boolean(url && uriUtils.isLocalhostOrPrivateIpUrl(url)),
    [url, urlValidateState],
  );
  const title = useMemo(() => {
    if (isLocalUrlBlocked) {
      return intl.formatMessage({
        id: ETranslations.browser_local_urls_blocked__title,
      });
    }
    if (urlValidateState === EValidateUrlEnum.InvalidPunycode) {
      return intl.formatMessage({
        id: ETranslations.explore_risky_domain,
      });
    }
    return intl.formatMessage({
      id: ETranslations.explore_connection_is_not_private,
    });
  }, [isLocalUrlBlocked, urlValidateState, intl]);
  const description = useMemo(() => {
    if (isLocalUrlBlocked) {
      return intl.formatMessage({
        id: ETranslations.browser_local_urls_blocked__desc,
      });
    }
    if (urlValidateState === EValidateUrlEnum.InvalidPunycode) {
      return intl.formatMessage({
        id: ETranslations.explore_risky_domain_warning,
      });
    }
    return intl.formatMessage({
      id: ETranslations.explore_connection_is_not_private_warning,
    });
  }, [isLocalUrlBlocked, urlValidateState, intl]);
  const content = useMemo(
    () => (
      <YStack
        fullscreen
        bg="$bgApp"
        justifyContent="center"
        alignItems="center"
        animation="quick"
        animateOnly={ANIMATE_ONLY_OPACITY}
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
