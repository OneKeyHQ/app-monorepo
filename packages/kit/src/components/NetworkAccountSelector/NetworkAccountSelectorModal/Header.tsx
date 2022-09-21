import React from 'react';

import {
  Box,
  IconButton,
  Pressable,
  Spinner,
  Text,
  VStack,
} from '@onekeyhq/components';
import useModalClose from '@onekeyhq/components/src/Modal/Container/useModalClose';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import reducerAccountSelector from '../../../store/reducers/reducerAccountSelector';
import { useAccountSelectorInfo } from '../hooks/useAccountSelectorInfo';

const { updateIsLoading } = reducerAccountSelector.actions;
function Header({
  accountSelectorInfo,
}: {
  accountSelectorInfo: ReturnType<typeof useAccountSelectorInfo>;
}) {
  const { selectedNetwork, isLoading } = accountSelectorInfo;
  const { dispatch } = backgroundApiProxy;
  const close = useModalClose();
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
            close();
          }}
        />
      )}
    </Box>
  );
}

export default Header;
