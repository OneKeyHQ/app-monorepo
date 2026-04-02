import { useCallback, useEffect, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import { Input, ScrollView, Stack } from '@onekeyhq/components';
import type { IInputProps, IScrollViewRef } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { OneKeyError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  IUniversalSearchResultItem,
  IUniversalSearchSingleResult,
} from '@onekeyhq/shared/types/search';

import { SearchPopover } from '../../views/Discovery/pages/Dashboard/Welcome/SearchPopover';

export interface IUniversalSearchInputProps extends Partial<IInputProps> {
  onAddressSelect?: (address: string) => void;
  onSearchChange?: (value: string) => void;
  onResultsChange?: (results: IUniversalSearchResultItem[]) => void;
  onLoadingChange?: (loading: boolean) => void;
  searchType?: 'address' | 'dapp' | 'full';
  renderResultItem?: (
    item: IUniversalSearchResultItem,
    index: number,
    onSelect: (address: string) => void,
  ) => React.ReactNode;
  placeholder?: string;
  minSearchLength?: number;
  debounceMs?: number;
  popoverContainerProps?: any;
  maxResultHeight?: number;
}

export function UniversalSearchInput({
  onAddressSelect,
  onSearchChange,
  onResultsChange,
  onLoadingChange,
  searchType = 'address',
  renderResultItem,
  placeholder,
  minSearchLength = 3,
  debounceMs = 300,
  popoverContainerProps,
  maxResultHeight = 240,
  ...inputProps
}: IUniversalSearchInputProps) {
  const intl = useIntl();
  const [searchValue, setSearchValue] = useState('');
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [_, setSelectedIndex] = useState(-1);
  const scrollViewRef = useRef<IScrollViewRef>(null);

  // Universal search using searchUrlAccount for address search
  const {
    result: searchResults,
    run: runSearch,
    isLoading,
  } = usePromiseResult<IUniversalSearchSingleResult | undefined>(
    async () => {
      if (!searchValue.trim() || searchValue.length < minSearchLength) {
        return undefined;
      }

      if (searchType === 'address') {
        return backgroundApiProxy.serviceUniversalSearch.searchUrlAccount({
          input: searchValue.trim(),
        });
      }

      // TODO: Add other search types (dapp, full) if needed
      return undefined;
    },
    [searchValue, searchType, minSearchLength],
    {
      watchLoading: true,
      debounced: debounceMs,
    },
  );

  // Notify parent about search results changes
  useEffect(() => {
    const results = searchResults?.items || [];
    onResultsChange?.(results);
  }, [searchResults, onResultsChange]);

  // Notify parent about loading state changes
  useEffect(() => {
    onLoadingChange?.(isLoading || false);
  }, [isLoading, onLoadingChange]);

  const handleInputChange = useCallback(
    (text: string) => {
      setSearchValue(text);
      onSearchChange?.(text);

      if (text.length >= minSearchLength) {
        setIsPopoverOpen(true);
        void runSearch();
      } else {
        setIsPopoverOpen(false);
      }
      setSelectedIndex(-1);
    },
    [runSearch, onSearchChange, minSearchLength],
  );

  const handleInputBlur = useCallback(() => {
    setTimeout(() => {
      setIsPopoverOpen(false);
    }, 200);
  }, []);

  const handleSelectAddress = useCallback(
    (address: string) => {
      setSearchValue(address);
      setIsPopoverOpen(false);
      onAddressSelect?.(address);
    },
    [onAddressSelect],
  );

  const renderSearchResults = useCallback(() => {
    if (!searchResults?.items || searchResults.items.length === 0) {
      return null;
    }

    return searchResults.items.map((item, index) => {
      if (renderResultItem) {
        return renderResultItem(item, index, handleSelectAddress);
      }
      throw new OneKeyError('renderResultItem is required');
    });
  }, [searchResults, renderResultItem, handleSelectAddress]);

  return (
    <Stack position="relative" width="100%">
      <Input
        placeholder={
          placeholder ||
          intl.formatMessage({
            id: ETranslations.wallet_track_any_address_placeholder,
          })
        }
        value={searchValue}
        onChangeText={handleInputChange}
        onFocus={() => {
          if (searchValue.length >= minSearchLength) {
            setIsPopoverOpen(true);
          }
        }}
        onBlur={handleInputBlur}
        autoComplete="new-password"
        data-form-type="other"
        data-1p-ignore=""
        data-lpignore="true"
        data-bwignore="true"
        addOns={
          isLoading
            ? [
                {
                  loading: true,
                  iconName: 'LoaderOutline',
                },
              ]
            : undefined
        }
        addOnsItemProps={{
          bg: '$bgApp',
        }}
        {...inputProps}
      />

      {/* Search Results Popover */}
      <SearchPopover
        isOpen={isPopoverOpen ? !!searchResults?.items?.length : false}
        containerProps={popoverContainerProps}
      >
        <ScrollView ref={scrollViewRef} maxHeight={maxResultHeight}>
          <Stack py="$2">{renderSearchResults()}</Stack>
        </ScrollView>
      </SearchPopover>
    </Stack>
  );
}
