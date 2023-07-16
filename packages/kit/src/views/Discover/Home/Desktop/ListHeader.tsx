import { type FC, useCallback, useState } from 'react';

import { useIntl } from 'react-intl';

import { Box, Center, Searchbar, Typography } from '@onekeyhq/components';

import { gotoSite } from '../../Explorer/Controller/gotoSite';
import { BrowserShortcuts } from '../BrowserShortcuts';

const TypographyStrong = (text: string) => (
  <Typography.DisplayXLarge color="text-success">
    {text}
  </Typography.DisplayXLarge>
);

export const ListHeader: FC = () => {
  const intl = useIntl();
  const [text, onChangeText] = useState('');
  const onSearch = useCallback(() => {
    if (text) {
      gotoSite({ url: text, userTriggered: true });
    }
  }, [text]);
  return (
    <Center>
      <Box width="640px">
        <Center mx="4" mt="8" mb="6">
          <Typography.DisplayXLarge>
            {intl.formatMessage(
              {
                id: 'title__explore_web_3_world_with_onekey',
              },
              { a: TypographyStrong },
            )}
          </Typography.DisplayXLarge>
        </Center>
        <Center>
          <Searchbar
            size="xl"
            w="full"
            placeholder={intl.formatMessage({
              id: 'content__search_dapps_or_type_url',
            })}
            value={text}
            onChangeText={onChangeText}
            onSubmitEditing={onSearch}
          />
        </Center>
        <Center>
          <Box w="360px">
            <BrowserShortcuts />
          </Box>
        </Center>
      </Box>
    </Center>
  );
};
