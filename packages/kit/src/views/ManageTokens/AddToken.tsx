import { useCallback, useEffect, useMemo, useState } from 'react';

import { useNavigation, useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Box,
  HStack,
  Icon,
  Image,
  KeyboardDismissView,
  Modal,
  Token,
  TokenVerifiedIcon,
  Typography,
  useToast,
} from '@onekeyhq/components';
import type { ModalProps } from '@onekeyhq/components/src/Modal';
import { Text } from '@onekeyhq/components/src/Typography';
import type { Token as TokenType } from '@onekeyhq/engine/src/types/token';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';
import type { WatchAssetParameters } from '@onekeyhq/shared/src/providerApis/ProviderApiEthereum/ProviderApiEthereum.types';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useAccountTokens, useManageTokens } from '../../hooks';
import { useActiveWalletAccount } from '../../hooks/redux';
import useDappApproveAction from '../../hooks/useDappApproveAction';
import useDappParams from '../../hooks/useDappParams';
import { wait } from '../../utils/helper';

import { useTokenSecurityInfo } from './hooks';
import { ManageTokenRoutes } from './types';

import type { ManageTokenRoutesParams } from './types';
import type { RouteProp } from '@react-navigation/core';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type RouteProps = RouteProp<
  ManageTokenRoutesParams,
  ManageTokenRoutes.AddToken
>;

type NavigationProps = NativeStackNavigationProp<
  ManageTokenRoutesParams,
  ManageTokenRoutes.AddToken
>;

type ListItem = { label: string; value: string };

export type IViewTokenModalProps = ModalProps;

const useRouteParams = () => {
  const routeProps = useRoute<RouteProps>();
  const { params } = routeProps;
  const { network } = useActiveWalletAccount();
  let token: Partial<TokenType>;
  if ('query' in params) {
    const query: WatchAssetParameters = JSON.parse(params.query);
    const { address, symbol, decimals, image } = query.options;
    token = {
      name: symbol ?? '',
      address,
      symbol: symbol ?? '',
      // @ts-ignore
      decimal: decimals ?? 0,
      logoURI: image ?? '',
    };
  } else {
    token = params;
  }
  const { data } = useTokenSecurityInfo(
    network?.id ?? '',
    token.tokenIdOnNetwork ?? token?.address ?? '',
  );
  if ('query' in params) {
    const query: WatchAssetParameters = JSON.parse(params.query);
    const { address, symbol, decimals, image } = query.options;
    return {
      name: symbol ?? '',
      address,
      symbol: symbol ?? '',
      decimal: decimals ?? 0,
      logoURI: image ?? '',
      security: data?.hasSecurity,
      verified: data?.hasSecurity === false,
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
  const { name, symbol, decimal, address } = token;
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
                <Token token={token} size="56px" />
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
                  <TokenVerifiedIcon
                    token={{
                      ...token,
                      networkId: activeNetwork?.id ?? '',
                    }}
                  />
                </Box>

                <HStack justifyContent="center" alignItems="center" mt="16px">
                  <Typography.Body1 mr="18px">
                    {sourceInfo?.origin?.split('://')[1] ?? 'DApp'}
                  </Typography.Body1>
                  <Icon size={20} name="ArrowsRightLeftMini" />
                  <Image
                    src={activeNetwork?.logoURI}
                    ml="18px"
                    mr="8px"
                    width="16px"
                    height="16px"
                    borderRadius="full"
                  />
                  <Typography.Body2 maxW="40" isTruncated>
                    {activeAccount?.name}
                  </Typography.Body2>
                </HStack>
              </Box>

              <Box
                borderRadius="12px"
                borderWidth={1}
                borderColor="border-subdued"
                mt="2"
                mb="3"
              >
                {items.map((item, index) => (
                  <Box
                    display="flex"
                    flexDirection="row"
                    justifyContent="space-between"
                    p="4"
                    alignItems="center"
                    key={index}
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
  const {
    walletId,
    account: activeAccount,
    network: activeNetwork,
  } = useActiveWalletAccount();
  const intl = useIntl();
  const [loading, setLoading] = useState(false);
  const accountTokens = useAccountTokens(activeNetwork?.id, activeAccount?.id);
  const navigation = useNavigation<NavigationProps>();
  const token = useRouteParams();
  const queryInfo = useDappParams();

  const { address, logoURI } = token;

  const dappApprove = useDappApproveAction({
    id: queryInfo.sourceInfo?.id ?? '',
  });

  const addAccountToken = useCallback(
    async ({ close } = {}) => {
      if (!activeAccount || !activeNetwork) {
        return;
      }
      try {
        setLoading(true);

        let addedToken = {
          address,
        } as TokenType | undefined;
        if (accountTokens.some((t) => t.tokenIdOnNetwork === address)) {
          toast.show({
            title: intl.formatMessage({
              id: 'msg__token_already_existed',
            }),
          });
        } else {
          addedToken = await backgroundApiProxy.serviceToken.addAccountToken(
            activeNetwork.id,
            activeAccount.id,
            address,
            logoURI,
          );
          toast.show({
            title: intl.formatMessage({
              id: 'msg__token_added',
              defaultMessage: 'Token Added',
            }),
          });
        }
        await wait(1000);
        await dappApprove.resolve({ close, result: addedToken });
        if (navigation.canGoBack()) {
          navigation.goBack();
        }
      } catch (error) {
        debugLogger.common.error('add token faild', error, address);
      }
      setLoading(false);
    },
    [
      accountTokens,
      activeAccount,
      activeNetwork,
      address,
      toast,
      intl,
      dappApprove,
      logoURI,
      navigation,
    ],
  );

  const onPrimaryActionPress = useCallback(async () => {
    if (activeAccount && activeNetwork) {
      const vaultSettings = await backgroundApiProxy.engine.getVaultSettings(
        activeNetwork?.id,
      );
      if (vaultSettings?.activateTokenRequired) {
        navigation.navigate(ManageTokenRoutes.ActivateToken, {
          walletId,
          accountId: activeAccount?.id,
          networkId: activeNetwork?.id,
          tokenId: address,
          onSuccess() {
            addAccountToken();
          },
        });
      } else {
        addAccountToken();
      }
    }
  }, [
    activeAccount,
    activeNetwork,
    addAccountToken,
    address,
    navigation,
    walletId,
  ]);

  return (
    <ViewTokenModal
      footer
      hideSecondaryAction
      primaryActionTranslationId="action__confirm"
      onModalClose={() => {
        dappApprove.reject();
      }}
      primaryActionProps={{
        isLoading: loading,
      }}
      onPrimaryActionPress={onPrimaryActionPress}
    />
  );
}

export { ViewTokenModal, AddTokenModal };
export const AddToken = AddTokenModal;
export default AddToken;
