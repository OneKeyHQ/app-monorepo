import type { FC } from 'react';
import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Button, ScrollView } from '@onekeyhq/components';
import type { MarketLinks } from '@onekeyhq/kit/src/store/reducers/market';
import { openUrl } from '@onekeyhq/kit/src/utils/openUrl';

type MarketInfoLinksProps = {
  links: MarketLinks;
};

export const MarketInfoLinks: FC<MarketInfoLinksProps> = ({ links }) => {
  const intl = useIntl();
  const goToLink = useCallback((url?: string, title?: string) => {
    openUrl(url ?? '', title, {
      modalMode: true,
    });
  }, []);
  const showCompoent = useMemo(
    () => Object.values(links).filter((u) => u.length).length,
    [links],
  );
  return showCompoent ? (
    <ScrollView mx={-4} horizontal flexDirection="row">
      {links?.homePageUrl?.length ? (
        <Button
          type="basic"
          size="base"
          leftIconName="GlobeAltOutline"
          mx={4}
          borderColor="border-default"
          borderRadius="12px"
          onPress={() => {
            goToLink(
              links?.homePageUrl,
              intl.formatMessage({ id: 'form__website' }),
            );
          }}
        >
          {intl.formatMessage({ id: 'form__website' })}
        </Button>
      ) : null}
      {links?.twitterUrl?.length ? (
        <Button
          type="basic"
          size="base"
          leftIconName="TwitterOutline"
          mr={4}
          borderColor="border-default"
          borderRadius="12px"
          onPress={() => {
            goToLink(links?.twitterUrl, 'Twitter');
          }}
        >
          Twitter
        </Button>
      ) : null}
      {links?.telegramUrl?.length ? (
        <Button
          type="basic"
          size="base"
          leftIconName="GlobeAltOutline"
          mr={4}
          borderColor="border-default"
          borderRadius="12px"
          onPress={() => {
            goToLink(links?.telegramUrl, 'Telegram');
          }}
        >
          Telegram
        </Button>
      ) : null}
      {links?.discordUrl?.length ? (
        <Button
          type="basic"
          size="base"
          leftIconName="DiscordOutline"
          mr={4}
          borderColor="border-default"
          borderRadius="12px"
          onPress={() => {
            goToLink(links?.discordUrl, 'Discord');
          }}
        >
          Discord
        </Button>
      ) : null}
    </ScrollView>
  ) : null;
};
