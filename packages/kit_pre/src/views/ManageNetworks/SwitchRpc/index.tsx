import type { FC } from 'react';
import { useCallback, useMemo, useRef } from 'react';

import { useRoute } from '@react-navigation/core';
import { useAsync } from 'react-async-hook';
import { useIntl } from 'react-intl';

import {
  Box,
  HStack,
  KeyboardDismissView,
  Modal,
  Skeleton,
  Text,
  Typography,
  VStack,
} from '@onekeyhq/components';
import type { SwitchRpcParams } from '@onekeyhq/engine/src/types/network';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import Speedindicator from '../../../components/NetworkAccountSelector/modals/NetworkAccountSelectorModal/SpeedIndicator';
import useDappApproveAction from '../../../hooks/useDappApproveAction';
import useDappParams from '../../../hooks/useDappParams';
import { updateCustomNetworkRpc } from '../../../store/reducers/settings';
import { wait } from '../../../utils/helper';
import { NetworkIcon } from '../components/NetworkIcon';
import { SiteSection } from '../components/SiteSection';
import { measureRpc, useRPCUrls } from '../hooks';

import type { MeasureResult } from '../hooks';
import type {
  ManageNetworkModalRoutes,
  ManageNetworkRoutesParams,
} from '../types';
import type { RouteProp } from '@react-navigation/core';

type RouteProps = RouteProp<
  ManageNetworkRoutesParams,
  ManageNetworkModalRoutes.SwitchRpc
>;

export type ListItem = { label: string; value?: any };

const useRouteParams = () => {
  const routeProps = useRoute<RouteProps>();
  const { params } = routeProps;
  if ('query' in params) {
    const query: SwitchRpcParams = JSON.parse(params.query);
    return query;
  }
  return params;
};

export const RpcStatus: FC<{
  measure?: MeasureResult;
}> = ({ measure }) => {
  const intl = useIntl();

  const { responseTime, iconColor, latestBlock } = measure || {};
  const responseTimeSection = useMemo(() => {
    if (!measure) {
      return <Skeleton shape="Caption" />;
    }
    return (
      <HStack alignItems="center">
        <Speedindicator borderWidth={0} backgroundColor={iconColor as any} />
        <Typography.Body1 color={iconColor} ml="2" textAlign="right">
          {typeof responseTime === 'number'
            ? `${responseTime} ms`
            : intl.formatMessage({ id: 'content__not_available' })}
        </Typography.Body1>
      </HStack>
    );
  }, [measure, iconColor, intl, responseTime]);

  const blockHeightSection = useMemo(() => {
    if (!measure) {
      return <Skeleton shape="Caption" />;
    }
    if (typeof latestBlock !== 'number' || !latestBlock) {
      return null;
    }
    return (
      <Typography.Caption color="text-subdued" textAlign="right">
        {intl.formatMessage({ id: 'content__height' })}: {latestBlock}
      </Typography.Caption>
    );
  }, [measure, intl, latestBlock]);

  return (
    <VStack alignItems="flex-end">
      {responseTimeSection}
      {blockHeightSection}
    </VStack>
  );
};

export function SwitchRpcModal() {
  const intl = useIntl();
  const resolveRef = useRef<boolean>(false);
  const { name, rpcURL, logoURI, networkId } = useRouteParams();
  const queryInfo = useDappParams();
  const dappApprove = useDappApproveAction({
    id: queryInfo.sourceInfo?.id ?? '',
    closeWindowAfterResolved: true,
  });

  const { result, loading } = useAsync(
    () => measureRpc(networkId, rpcURL, false),
    [networkId, rpcURL],
  );

  const {
    preset,
    custom,
    defaultRpc,
    loading: getRpcLoading,
  } = useRPCUrls(networkId);

  const isDisabled = useMemo(() => loading || !result, [loading, result]);

  const hasAdded = useMemo(
    () =>
      preset.includes(rpcURL) ||
      custom.includes(rpcURL) ||
      defaultRpc === rpcURL,
    [preset, custom, rpcURL, defaultRpc],
  );

  const items: ListItem[] = useMemo(() => {
    const data = [
      {
        label: intl.formatMessage({
          id: 'network__network',
          defaultMessage: 'Network',
        }),
        value: name,
      },
      {
        label: intl.formatMessage({
          id: 'form__url',
          defaultMessage: 'RPC Node',
        }),
        value: rpcURL,
      },
      {
        label: intl.formatMessage({
          id: 'form__status',
          defaultMessage: 'Status',
        }),
        value: <RpcStatus measure={loading ? undefined : result} />,
      },
    ];
    return data;
  }, [intl, name, rpcURL, loading, result]);

  const descSection = useMemo(() => {
    if (hasAdded) {
      return (
        <>
          <Typography.PageHeading mt="4">{`${intl.formatMessage({
            id: 'title__youve_added_this_rpc_node',
          })}`}</Typography.PageHeading>
          <Typography.Body1 mt="2">
            {intl.formatMessage({
              id: 'title__you_ve_added_this_rpc_node_desc',
            })}
          </Typography.Body1>
        </>
      );
    }
    return (
      <>
        <Typography.PageHeading mt="4">{`${intl.formatMessage({
          id: 'title__add_rpc_node',
        })}`}</Typography.PageHeading>
        <SiteSection url={queryInfo?.sourceInfo?.origin} mt="2" w="full" />
        <Typography.Body1 mt="2">
          {intl.formatMessage({ id: 'title__add_rpc_node_desc' })}
        </Typography.Body1>
      </>
    );
  }, [hasAdded, intl, queryInfo?.sourceInfo?.origin]);

  const addRpc = useCallback(
    async ({ close }) => {
      backgroundApiProxy.dispatch(
        updateCustomNetworkRpc({
          networkId,
          type: 'add',
          rpc: rpcURL,
        }),
      );
      resolveRef.current = true;
      await dappApprove.resolve({
        close,
        result: null,
      });
    },
    [rpcURL, networkId, dappApprove],
  );

  const onPrimaryActionPress = useCallback(
    async ({ close }) => {
      if (!rpcURL) {
        return;
      }
      if (!hasAdded) {
        backgroundApiProxy.dispatch(
          updateCustomNetworkRpc({
            networkId,
            type: 'add',
            rpc: rpcURL,
          }),
        );
        await wait(1000);
      }
      resolveRef.current = true;
      await backgroundApiProxy.serviceNetwork.updateNetwork(networkId, {
        rpcURL,
      });
      await dappApprove.resolve({
        close,
        result: null,
      });
    },
    [rpcURL, hasAdded, networkId, dappApprove],
  );

  const onModalClose = useCallback(() => {
    if (!resolveRef.current) {
      dappApprove.reject();
    }
  }, [dappApprove]);

  return (
    <Modal
      height="560px"
      enableMobileFooterWrap
      onModalClose={onModalClose}
      secondaryActionTranslationId="action__add_to_rpc_node_list_only"
      primaryActionTranslationId={
        hasAdded ? 'action__switch' : 'action__add_n_switch'
      }
      hideSecondaryAction={hasAdded || getRpcLoading}
      onSecondaryActionPress={addRpc}
      onPrimaryActionPress={onPrimaryActionPress}
      secondaryActionProps={{
        isDisabled,
      }}
      primaryActionProps={{
        isDisabled,
      }}
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
                <NetworkIcon
                  size="64px"
                  name={name}
                  logoURI={logoURI}
                  iconName="PlusCircleSolid"
                />
                {descSection}
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
                    {typeof item.value === 'string' ? (
                      <Text
                        typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}
                        textAlign="right"
                        flex="1"
                        isTruncated
                        pl="6"
                      >
                        {item.value}
                      </Text>
                    ) : (
                      item.value
                    )}
                  </Box>
                ))}
              </Box>
            </Box>
          </KeyboardDismissView>
        ),
      }}
    />
  );
}
