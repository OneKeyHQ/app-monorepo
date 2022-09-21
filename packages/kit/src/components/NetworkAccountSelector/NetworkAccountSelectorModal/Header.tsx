import React from 'react';

import {
  Box,
  IconButton,
  Pressable,
  Spinner,
  Text,
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
      flexDirection="row"
      alignItems="center"
      pt={3.5}
      pr={3.5}
      pb={2}
      pl={4}
    >
      <Box flexDirection="row" alignItems="center" flex={1} mr={3}>
        <Text typography="Heading" isTruncated>
          {selectedNetwork?.shortName || '-'}
        </Text>

        {isLoading ? (
          <Pressable
            ml={2}
            onPress={() => {
              dispatch(updateIsLoading(false));
            }}
          >
            <Spinner size="sm" />
          </Pressable>
        ) : null}
      </Box>

      <IconButton
        name="CloseSolid"
        type="plain"
        circle
        onPress={() => {
          close();
        }}
      />
    </Box>
  );
}

export default Header;
