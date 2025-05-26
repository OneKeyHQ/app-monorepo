import { useCallback } from 'react';

import { StyleSheet } from 'react-native';

import { Icon, Image, Skeleton } from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { useUniversalSearchActions } from '@onekeyhq/kit/src/states/jotai/contexts/universalSearch';
import { isGoogleSearchItem } from '@onekeyhq/shared/src/consts/discovery';
import { EEnterMethod } from '@onekeyhq/shared/src/logger/scopes/discovery/scenes/dapp';
import type { IUniversalSearchDapp } from '@onekeyhq/shared/types/search';

import { useWebSiteHandler } from '../../../Discovery/hooks/useWebSiteHandler';

interface IUniversalSearchDappItemProps {
  item: IUniversalSearchDapp;
  getSearchInput: () => string;
}

export function UniversalSearchDappItem({
  item,
  getSearchInput,
}: IUniversalSearchDappItemProps) {
  const { name, dappId, logo } = item.payload;
  const isGoogle = isGoogleSearchItem(dappId);
  const handleWebSite = useWebSiteHandler();
  const universalSearchActions = useUniversalSearchActions();

  // Extract main domain from URL and apply length rules
  const extractMainDomain = useCallback((url: string): string => {
    try {
      // Remove protocol and www
      let domain = url.replace(/^https?:\/\//, '').replace(/^www\./, '');

      // Remove path, query, and fragment
      domain = domain.split('/')[0].split('?')[0].split('#')[0];

      // Apply length rules: ≤12 characters show all, >12 characters truncate
      if (domain.length <= 12) {
        return domain;
      }
      // Truncate and add ellipsis
      return `${domain.substring(0, 9)}...`;
    } catch {
      return url;
    }
  }, []);

  // Check if input is URL and process display text
  const processSearchInput = useCallback(
    (searchInput: string, fallbackText: string) => {
      const isUrl =
        searchInput.match(/^https?:\/\//) || searchInput.includes('.');
      const displayText = isUrl ? extractMainDomain(searchInput) : fallbackText;

      return {
        isUrl,
        displayText,
        originalInput: searchInput,
      };
    },
    [extractMainDomain],
  );

  const handlePress = useCallback(() => {
    console.log('[universalSearch] renderItem: ', item);
    handleWebSite({
      dApp: isGoogle ? undefined : item.payload,
      // @ts-expect-error
      webSite: isGoogle
        ? {
            title: 'Google',
            url: getSearchInput(),
          }
        : undefined,
      enterMethod: EEnterMethod.search,
    });

    // Add to recent search list
    setTimeout(() => {
      const searchInput = getSearchInput();
      const { isUrl, displayText } = processSearchInput(
        searchInput,
        isGoogle ? searchInput : name,
      );

      if (isGoogle) {
        const encodedSearchInput = encodeURIComponent(searchInput);
        universalSearchActions.current.addIntoRecentSearchList({
          id: `dapp-google-search-${encodedSearchInput}`,
          text: displayText,
          type: item.type,
          timestamp: Date.now(),
          extra: {
            isGoogleSearch: 'true',
            searchQuery: searchInput,
            originalUrl: searchInput,
            autoFillText: isUrl ? searchInput : displayText,
          },
        });
      } else {
        const recordId = isUrl
          ? `dapp-url-${encodeURIComponent(searchInput)}`
          : `dapp-${dappId}-${encodeURIComponent(name)}`;

        universalSearchActions.current.addIntoRecentSearchList({
          id: recordId,
          text: displayText,
          type: item.type,
          timestamp: Date.now(),
          extra: {
            dappId,
            dappName: name,
            dappUrl: item.payload.url || '',
            autoFillText: isUrl ? searchInput : displayText,
            ...(isUrl
              ? {
                  isUrlSearch: 'true',
                  originalUrl: searchInput,
                }
              : {}),
          },
        });
      }
    }, 10);
  }, [
    getSearchInput,
    handleWebSite,
    isGoogle,
    item,
    name,
    dappId,
    universalSearchActions,
    processSearchInput,
  ]);

  return (
    <ListItem
      onPress={handlePress}
      renderAvatar={
        <Image
          size="$10"
          borderRadius="$2"
          borderWidth={StyleSheet.hairlineWidth}
          borderColor="$borderSubdued"
        >
          <Image.Source source={{ uri: logo }} />
          <Image.Loading>
            <Skeleton width="100%" height="100%" />
          </Image.Loading>
          <Image.Fallback
            bg="$bgStrong"
            justifyContent="center"
            alignItems="center"
          >
            <Icon name="GlobusOutline" />
          </Image.Fallback>
        </Image>
      }
      title={name}
      titleProps={{
        color: isGoogle ? '$textSubdued' : '$text',
      }}
    />
  );
}
