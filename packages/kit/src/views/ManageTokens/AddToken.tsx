import React, { useCallback, useEffect, useMemo } from 'react';

import { RouteProp, useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Box,
  Center,
  HStack,
  Icon,
  Image,
  KeyboardDismissView,
  Modal,
  TokenVerifiedIcon,
  Typography,
  useToast,
} from '@onekeyhq/components';
import { ModalProps } from '@onekeyhq/components/src/Modal';
import { Text } from '@onekeyhq/components/src/Typography';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { WatchAssetParameters } from '../../background/providers/ProviderApiEthereum';
import { useManageTokens } from '../../hooks';
import { useActiveWalletAccount } from '../../hooks/redux';
import useDappApproveAction from '../../hooks/useDappApproveAction';
import useDappParams from '../../hooks/useDappParams';

import { ManageTokenRoutes, ManageTokenRoutesParams } from './types';

type RouteProps = RouteProp<
  ManageTokenRoutesParams,
  ManageTokenRoutes.AddToken
>;

type ListItem = { label: string; value: string };

export type IViewTokenModalProps = ModalProps;

const useRouteParams = () => {
  const routeProps = useRoute<RouteProps>();
  const { params } = routeProps;
  if ('query' in params) {
    const query: WatchAssetParameters = JSON.parse(params.query);
    const { address, symbol, decimals, image } = query.options;
    return {
      name: symbol ?? '',
      address,
      symbol: symbol ?? '',
      decimal: decimals ?? 0,
      logoURI: image ?? '',
    };
  }
  return params;
};

function ViewTokenModal(props: IViewTokenModalProps) {
  const { balances } = useManageTokens();
  const { account: activeAccount, network: activeNetwork } =
    useActiveWalletAccount();
  const intl = useIntl();
  const { sourceInfo } = useDappParams();
  const token = useRouteParams();
  const { name, symbol, decimal, address, logoURI } = token;
  const items: ListItem[] = useMemo(() => {
    const data = [
      {
        label: intl.formatMessage({
          id: 'form__name',
          defaultMessage: 'Name',
        }),
        value: name,
      },
      {
        label: intl.formatMessage({
          id: 'form__symbol',
          defaultMessage: 'Symbol',
        }),
        value: symbol,
      },
      {
        label: intl.formatMessage({
          id: 'form__contract',
          defaultMessage: 'Contact',
        }),
        value: address,
      },
      {
        label: intl.formatMessage({
          id: 'form__decimal',
          defaultMessage: 'Decimal',
        }),
        value: String(decimal),
      },
    ].filter(({ value }) => !!value);

    if (balances[address]) {
      data.push({
        label: intl.formatMessage({
          id: 'content__balance',
          defaultMessage: 'Balance',
        }),
        value: balances[address] ?? '0',
      });
    }
    return data;
  }, [name, symbol, address, decimal, balances, intl]);
  useEffect(() => {
    async function fetchBalance() {
      if (activeAccount && activeNetwork) {
        await backgroundApiProxy.serviceToken.fetchTokenBalance({
          activeAccountId: activeAccount.id,
          activeNetworkId: activeNetwork.id,
          tokenIds: [address],
        });
      }
    }
    fetchBalance();
  }, [activeAccount, activeNetwork, address]);
  return (
    <Modal
      height="560px"
      footer={null}
      scrollViewProps={{
        children: (
          <KeyboardDismissView>
            <Box>
              <Box
                flexDirection="column"
                alignItems="center"
                justifyContent="center"
                mb="8"
                mt="6"
              >
                <Image
                  src={logoURI}
                  alt="logoURI"
                  size="56px"
                  borderRadius="full"
                  fallbackElement={
                    <Center
                      w="56px"
                      h="56px"
                      rounded="full"
                      bgColor="surface-neutral-default"
                    >
                      <Icon size={32} name="QuestionMarkOutline" />
                    </Center>
                  }
                />

                <Box
                  alignItems="center"
                  flexDirection="row"
                  justifyContent="center"
                  mt="4"
                >
                  <Typography.PageHeading>
                    {intl.formatMessage(
                      { id: 'title__adding_str' },
                      {
                        0: symbol,
                      },
                    )}
                  </Typography.PageHeading>
                  <TokenVerifiedIcon token={token} />
                </Box>

                <HStack justifyContent="center" alignItems="center" mt="16px">
                  <Typography.Body1 mr="18px">
                    {sourceInfo?.origin?.split('://')[1] ?? 'DApp'}
                  </Typography.Body1>
                  <Icon size={20} name="SwitchHorizontalSolid" />
                  <Image
                    src={activeNetwork?.logoURI}
                    ml="18px"
                    mr="8px"
                    width="16px"
                    height="16px"
                    borderRadius="full"
                  />
                  <Typography.Body2>{activeAccount?.name}</Typography.Body2>
                </HStack>
              </Box>

              <Box bg="surface-default" borderRadius="12" mt="2" mb="3">
                {items.map((item, index) => (
                  <Box
                    display="flex"
                    flexDirection="row"
                    justifyContent="space-between"
                    p="4"
                    alignItems="center"
                    key={index}
                    borderTopRadius={index === 0 ? '12' : undefined}
                    borderBottomRadius={
                      index === items.length - 1 ? '12' : undefined
                    }
                    borderTopColor="divider"
                    borderTopWidth={index !== 0 ? '1' : undefined}
                  >
                    <Text
                      typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}
                      color="text-subdued"
                    >
                      {item.label}
                    </Text>
                    <Text
                      typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}
                      maxW="56"
                      textAlign="right"
                    >
                      {item.value}
                    </Text>
                  </Box>
                ))}
              </Box>
            </Box>
          </KeyboardDismissView>
        ),
      }}
      {...props}
    />
  );
}

function AddTokenModal() {
  const toast = useToast();
  const { account: activeAccount, network: activeNetwork } =
    useActiveWalletAccount();
  const intl = useIntl();
  const { address } = useRouteParams();
  const queryInfo = useDappParams();

  const dappApprove = useDappApproveAction({
    id: queryInfo.sourceInfo?.id ?? '',
  });

  const onPrimaryActionPress = useCallback(
    async ({ close } = {}) => {
      if (activeAccount && activeNetwork) {
        const addedToken = await backgroundApiProxy.engine.quickAddToken(
          activeAccount.id,
          activeNetwork.id,
          address,
        );
        toast.show({
          title: intl.formatMessage({
            id: 'msg__token_added',
            defaultMessage: 'Token Added',
          }),
        });
        await dappApprove.resolve({ close, result: addedToken });
      }
    },
    [activeAccount, activeNetwork, address, toast, intl, dappApprove],
  );

  return (
    <ViewTokenModal
      footer
      hideSecondaryAction
      primaryActionTranslationId="action__confirm"
      onModalClose={() => {
        dappApprove.reject();
      }}
      onPrimaryActionPress={onPrimaryActionPress}
    />
  );
}

export { ViewTokenModal, AddTokenModal };
export const AddToken = AddTokenModal;
export default AddToken;
