/* eslint-disable no-nested-ternary */
import React from 'react';

import { useIntl } from 'react-intl';

import {
  Box,
  Icon,
  IconButton,
  Pressable,
  Select,
  Spinner,
  Text,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import useModalClose from '@onekeyhq/components/src/Modal/Container/useModalClose';
import WalletAvatar from '@onekeyhq/kit/src/components/WalletSelector/WalletAvatar';

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
  const intl = useIntl();
  const isVerticalLayout = useIsVerticalLayout();
  return (
    <Box pr={3.5}>
      <Box flexDirection="row" alignItems="center" pt={3.5} pb={2} pl={4}>
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
      <Box flexDirection="row" alignItems="center" pl={2}>
        <Select
          title={intl.formatMessage({ id: 'title__wallets' })}
          footer={null}
          defaultValue="scan"
          activatable={false}
          containerProps={{
            flex: 1,
            alignItems: 'flex-start',
          }}
          options={[
            {
              label: 'Wallet #1',
              value: 'scan',
            },
            {
              label: 'Wallet #2',
              value: 'expand',
            },
            {
              label: 'Wallet #3',
              value: 'lock',
            },
          ]}
          renderTrigger={({ visible, onPress }) => (
            <Pressable onPress={onPress}>
              {({ isHovered, isPressed }) => (
                <Box
                  flexDirection="row"
                  p={2}
                  alignItems="center"
                  rounded="xl"
                  bgColor={
                    visible
                      ? 'surface-selected'
                      : isPressed
                      ? 'surface-pressed'
                      : isHovered
                      ? 'surface-hovered'
                      : undefined
                  }
                >
                  <WalletAvatar size="xs" />
                  <Text typography="Body1Strong" mx={2} isTruncated>
                    Wallet Name
                  </Text>
                  <Icon name="SelectorSolid" size={20} />
                </Box>
              )}
            </Pressable>
          )}
          renderItem={(item, isActive) => (
            <>
              <Pressable>
                {({ isHovered, isPressed }) => (
                  <Box
                    p={2}
                    pr={{ base: 3, md: 2 }}
                    flexDirection="row"
                    alignItems="center"
                    bgColor={
                      isPressed
                        ? 'surface-pressed'
                        : isHovered
                        ? 'surface-hovered'
                        : undefined
                    }
                    rounded="xl"
                  >
                    <WalletAvatar size={isVerticalLayout ? 'lg' : 'xs'} />
                    <Text
                      typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}
                      flex={1}
                      mx={3}
                    >
                      {item.label}
                    </Text>
                    {isActive ? (
                      <Icon
                        name={isVerticalLayout ? 'CheckOutline' : 'CheckSolid'}
                        size={isVerticalLayout ? 24 : 20}
                        color="interactive-default"
                      />
                    ) : null}
                  </Box>
                )}
              </Pressable>
            </>
          )}
        />
        <IconButton name="PlusSolid" type="plain" circle hitSlop={8} />
      </Box>
    </Box>
  );
}

export default Header;
