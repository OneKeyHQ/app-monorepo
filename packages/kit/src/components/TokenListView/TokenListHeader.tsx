import { useCallback } from 'react';

import {
  Button,
  SearchBar,
  SizableText,
  Stack,
  XStack,
  useMedia,
} from '@onekeyhq/components';

import useAppNavigation from '../../hooks/useAppNavigation';
import { EModalRoutes } from '../../routes/Modal/type';
import { useActiveAccount } from '../../states/jotai/contexts/accountSelector';
import {
  useRiskyTokenListAtom,
  useRiskyTokenListMapAtom,
} from '../../states/jotai/contexts/token-list';
import { EModalAssetListRoutes } from '../../views/AssetList/router/types';

type IProps = {
  tableLayout?: boolean;
};

function TokenListHeader({ tableLayout }: IProps) {
  const navigation = useAppNavigation();
  const media = useMedia();

  const {
    activeAccount: { account, network },
  } = useActiveAccount({ num: 0 });

  const [riskyTokenList] = useRiskyTokenListAtom();
  const [riskyTokenListMap] = useRiskyTokenListMapAtom();

  const { riskyTokens, keys: riskyTokenKeys } = riskyTokenList;

  const handleHiddenPress = useCallback(() => {
    if (!account || !network || riskyTokens.length === 0) return;
    navigation.pushModal(EModalRoutes.AssetListModal, {
      screen: EModalAssetListRoutes.TokenList,
      params: {
        title: 'Blocked Assets',
        accountId: account.id,
        networkId: network.id,
        tokenList: {
          tokens: riskyTokens,
          keys: riskyTokenKeys,
          map: riskyTokenListMap,
        },
      },
    });
  }, [
    account,
    navigation,
    network,
    riskyTokenKeys,
    riskyTokenListMap,
    riskyTokens,
  ]);

  return (
    <Stack p="$5" pb="$3">
      <XStack justifyContent="space-between">
        <SearchBar
          placeholder="Search..."
          containerProps={{
            flex: 1,
            mr: '$2.5',
            maxWidth: '$80',
          }}
        />
        <Button
          {...(media.gtMd && {
            icon: 'EyeOffOutline',
          })}
          onPress={handleHiddenPress}
        >
          {`${riskyTokens.length} Blocked`}
        </Button>
      </XStack>
      {tableLayout && (
        <XStack space="$3" pt="$5">
          <SizableText color="$textSubdued" size="$headingXs" mr={44} w="$32">
            Assets
          </SizableText>
          <XStack space="$2">
            <SizableText
              color="$textSubdued"
              textAlign="right"
              size="$headingXs"
              w="$32"
              $gtXl={{
                w: '$56',
              }}
              $gt2xl={{
                w: '$72',
              }}
            >
              Price
            </SizableText>
            <Stack w="$24" />
          </XStack>
          <SizableText
            color="$textSubdued"
            size="$headingXs"
            textAlign="right"
            w="$36"
            $gtXl={{
              w: '$56',
            }}
            $gt2xl={{
              w: '$72',
            }}
          >
            Amount
          </SizableText>
          <SizableText
            flex={1}
            textAlign="right"
            color="$textSubdued"
            size="$headingXs"
          >
            Value
          </SizableText>
        </XStack>
      )}
    </Stack>
  );
}

export { TokenListHeader };
