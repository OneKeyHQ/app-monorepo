import { StyleSheet } from 'react-native';

import { Icon, Image, Skeleton } from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
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

  return (
    <ListItem
      onPress={() => {
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
      }}
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
