import type { FC } from 'react';
import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Button, HStack, IconButton, Typography } from '@onekeyhq/components';

import showExtraFilters from './Overlays/ExtraFilters';
import { AssetType } from './types';

import type { Filter } from './types';

export type Props = Filter & {
  onChange: (filter: Filter) => void;
  isFromRpc: boolean;
};

const FilterBar: FC<Props> = (props) => {
  const intl = useIntl();
  const { onChange, ...filter } = props;

  const { assetType } = filter;

  const handleChange = useCallback(
    (value: Partial<Omit<typeof filter, 'children'>>) => {
      onChange?.({
        ...filter,
        ...value,
      });
    },
    [filter, onChange],
  );

  const showExtraFiltersOverlay = useCallback(
    () =>
      showExtraFilters({
        ...filter,
        onChange: handleChange,
      }),
    [filter, handleChange],
  );

  return (
    <HStack my="6">
      <HStack flex="1">
        <Button
          type="plain"
          backgroundColor={
            assetType === AssetType.tokens ? 'surface-selected' : undefined
          }
          onPress={() => handleChange({ assetType: AssetType.tokens })}
        >
          <HStack alignItems="center">
            <Typography.Body2Strong>💰️</Typography.Body2Strong>
            <Typography.Body2Strong ml="1">
              {intl.formatMessage({ id: 'form__token' })}
            </Typography.Body2Strong>
          </HStack>
        </Button>
        <Button
          type="plain"
          ml="2"
          onPress={() => handleChange({ assetType: AssetType.nfts })}
          backgroundColor={
            assetType === AssetType.nfts ? 'surface-selected' : undefined
          }
        >
          <HStack alignItems="center">
            <Typography.Body2Strong>🖼</Typography.Body2Strong>
            <Typography.Body2Strong ml="2">NFTs</Typography.Body2Strong>
          </HStack>
        </Button>
      </HStack>
      <IconButton
        size="sm"
        name="CogMini"
        type="plain"
        mr={-2}
        onPress={showExtraFiltersOverlay}
        minW="42px"
      />
    </HStack>
  );
};

export default FilterBar;
