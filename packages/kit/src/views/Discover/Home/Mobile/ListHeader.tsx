import type { FC } from 'react';

import { useIntl } from 'react-intl';

import { Box, Typography } from '@onekeyhq/components';

import ExplorerBar from '../../Explorer/Mobile/ExplorerBarMobile';
import { useExplorerSearch } from '../../hooks/useExplorerSearch';
import { BrowserShortcuts } from '../BrowserShortcuts';

import { DAppCategories } from './DAppCategories';

const TypographyStrong = (text: string) => (
  <Typography.DisplayXLarge color="text-success">
    {text}
  </Typography.DisplayXLarge>
);

type ListHeaderProps = {
  showDappCategories?: boolean;
};

export const ListHeader: FC<ListHeaderProps> = ({ showDappCategories }) => {
  const intl = useIntl();
  const onSearch = useExplorerSearch();
  return (
    <Box>
      <Box mx="4" mt="8" mb="6">
        <Typography.DisplayXLarge>
          {intl.formatMessage(
            {
              id: 'title__explore_web_3_world_with_onekey_multiline',
            },
            { a: TypographyStrong },
          )}
        </Typography.DisplayXLarge>
      </Box>
      <ExplorerBar
        onSearch={() => onSearch({ isNewWindow: true, defaultUrl: '' })}
      />
      <BrowserShortcuts />
      {showDappCategories ? (
        <Box mt="8">
          <DAppCategories />
        </Box>
      ) : null}
    </Box>
  );
};
