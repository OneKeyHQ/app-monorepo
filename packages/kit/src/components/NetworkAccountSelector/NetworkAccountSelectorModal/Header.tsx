import React from 'react';

import {
  Box,
  IconButton,
  Pressable,
  Spinner,
  Text,
  VStack,
} from '@onekeyhq/components';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import useAppNavigation from '../../../hooks/useAppNavigation';
import reducerAccountSelector from '../../../store/reducers/reducerAccountSelector';
import { useAccountSelectorInfo } from '../../Header/AccountSelectorChildren/useAccountSelectorInfo';

const { updateIsLoading } = reducerAccountSelector.actions;
function Header({
  accountSelectorInfo,
}: {
  accountSelectorInfo: ReturnType<typeof useAccountSelectorInfo>;
}) {
  const navigation = useAppNavigation();
  const { selectedNetwork, isLoading } = accountSelectorInfo;
  const { dispatch } = backgroundApiProxy;
  return (
    <Box
      // position="absolute"
      // top={0}
      // right={0}
      // zIndex={9999}
      flexDirection="row"
      alignItems="center"
      pt={3.5}
      pr={3.5}
      pb={2}
      pl={4}
    >
      <VStack flex={1} mr={3}>
        <Text typography="Heading" isTruncated>
          {selectedNetwork?.shortName || '-'}
        </Text>
        <Text typography="Caption" color="text-subdued" isTruncated>
          {selectedNetwork?.name || selectedNetwork?.shortName || '-'}
        </Text>
      </VStack>

      {isLoading ? (
        <Pressable
          p={2}
          onPress={() => {
            dispatch(updateIsLoading(false));
          }}
        >
          <Spinner size="sm" />
        </Pressable>
      ) : (
        <IconButton
          name="CloseSolid"
          type="plain"
          circle
          onPress={() => {
            if (navigation.canGoBack()) {
              navigation.goBack();
            }
          }}
        />
      )}
    </Box>
  );
}

export default Header;
