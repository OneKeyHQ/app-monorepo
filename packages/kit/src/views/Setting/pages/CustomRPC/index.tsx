import { useCallback, useEffect, useRef, useState } from 'react';

import { useDebouncedCallback } from 'use-debounce';

import {
  ActionList,
  Badge,
  Button,
  Dialog,
  Divider,
  Empty,
  IconButton,
  Input,
  ListView,
  Page,
  SizableText,
  Skeleton,
  Spinner,
  Stack,
  Switch,
  XStack,
  YStack,
  useDialogInstance,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { NetworkAvatar } from '@onekeyhq/kit/src/components/NetworkAvatar';
import { TokenIconView } from '@onekeyhq/kit/src/components/TokenListView/TokenIconView';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import useConfigurableChainSelector from '@onekeyhq/kit/src/views/ChainSelector/hooks/useChainSelector';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import uriUtils from '@onekeyhq/shared/src/utils/uriUtils';
import type { IServerNetwork } from '@onekeyhq/shared/types';
import type { ICustomRpcItem } from '@onekeyhq/shared/types/customRpc';

type IEditRpcParams = {
  network: IServerNetwork;
  rpcInfo?: ICustomRpcItem;
};

enum ECustomStatus {
  'Fast' = 'Fast',
  'Normal' = 'Normal',
  'NotAvailable' = 'NotAvailable',
}

type IMeasureRpcItem = {
  responseTime: number;
  status: ECustomStatus;
  loading: boolean;
};

function ListHeaderComponent({ data }: { data: ICustomRpcItem[] }) {
  return (
    <>
      <SizableText px="$5" size="$bodyLg" color="$textSubdued">
        When modified, the custom RPC will replace OneKey’s node. To revert to
        OneKey’s node, disabled or delete the custom RPC.
      </SizableText>
      {data.length > 0 ? <Divider my="$5" /> : null}
    </>
  );
}

function ListEmptyComponent({
  onAddCustomRpc,
}: {
  onAddCustomRpc: () => void;
}) {
  return (
    <Empty
      flex={1}
      icon="BezierNodesOutline"
      title="No custom RPC"
      button={
        <Button
          mt="$6"
          size="medium"
          variant="primary"
          onPress={() => onAddCustomRpc()}
        >
          Add custom RPC
        </Button>
      }
    />
  );
}

function DialogContent({
  network,
  rpcInfo,
  onConfirm,
}: {
  network: IServerNetwork;
  rpcInfo?: ICustomRpcItem;
  onConfirm: () => void;
}) {
  const [isLoading, setIsLoading] = useState(false);
  const { close } = useDialogInstance();
  return (
    <>
      <Dialog.Header>
        <Stack mb="$5">
          <NetworkAvatar networkId={network.id} size="$8" />
        </Stack>
        <Dialog.Title>{`Custom ${network.name} RPC URL`}</Dialog.Title>
      </Dialog.Header>
      <Dialog.Form
        formProps={{
          defaultValues: { rpc: rpcInfo?.rpc || '' },
        }}
      >
        <Dialog.FormField
          label="RPC URL"
          name="rpc"
          rules={{
            required: {
              value: true,
              message: 'Invalid RPC',
            },
            validate: (value) => {
              if (!uriUtils.parseUrl(value)) {
                return 'Invalid RPC';
              }
            },
          }}
        >
          <Input autoFocus flex={1} />
        </Dialog.FormField>
      </Dialog.Form>
      <Dialog.Footer
        onConfirm={async (values) => {
          const { serviceCustomRpc } = backgroundApiProxy;
          setIsLoading(true);
          const rpcUrl: string = values.getForm()?.getValues('rpc');
          const networkId = network.id;
          await serviceCustomRpc.measureRpcStatus({
            rpcUrl,
            networkId,
          });
          await serviceCustomRpc.addCustomRpc({
            rpc: rpcUrl,
            networkId,
            enabled: rpcInfo?.enabled ?? true,
          });
          setIsLoading(false);
          await close();
          onConfirm();
        }}
        confirmButtonProps={{
          loading: isLoading,
        }}
      />
    </>
  );
}

function CustomRPC() {
  const { result: customRpcData, run } = usePromiseResult(async () => {
    const { serviceNetwork, serviceCustomRpc } = backgroundApiProxy;
    const _supportNetworks = await serviceNetwork.getCustomRpcEnabledNetworks();
    const _customRpcNetworks = await serviceCustomRpc.getAllCustomRpc();
    return {
      supportNetworks: _supportNetworks,
      customRpcNetworks: _customRpcNetworks,
    };
  }, []);
  const [rpcSpeedMap, setRpcSpeedMap] = useState<
    Record<string, IMeasureRpcItem>
  >({});
  const previousRpcInfosRef = useRef<ICustomRpcItem[] | undefined>();
  const measureRpcSpeed = useCallback(async (rpcInfo: ICustomRpcItem) => {
    try {
      const { responseTime } =
        await backgroundApiProxy.serviceCustomRpc.measureRpcStatus({
          rpcUrl: rpcInfo.rpc,
          networkId: rpcInfo.networkId,
        });
      return {
        responseTime,
        status: responseTime < 1000 ? ECustomStatus.Fast : ECustomStatus.Normal,
        loading: false,
      };
    } catch (e) {
      console.error(`Error testing RPC: ${rpcInfo.rpc}: `, e);
      return {
        responseTime: -1,
        status: ECustomStatus.NotAvailable,
        loading: false,
      };
    }
  }, []);
  const updateRpcMeasureData = useDebouncedCallback(
    async ({
      currentRpcInfos,
      previousRpcInfos,
    }: {
      currentRpcInfos: ICustomRpcItem[];
      previousRpcInfos: ICustomRpcItem[] | undefined;
    }) => {
      const updatedOrNewRpcInfos = currentRpcInfos.filter((current) => {
        const previous = previousRpcInfos?.find(
          (prev) => prev.networkId === current.networkId,
        );
        return !previous || previous.rpc !== current.rpc;
      });

      setRpcSpeedMap((prev) => {
        const newMap = { ...prev };
        updatedOrNewRpcInfos.forEach((rpcInfo) => {
          newMap[rpcInfo.networkId] = {
            ...newMap[rpcInfo.networkId],
            loading: true,
          };
        });
        return newMap;
      });
      for (const rpcInfo of updatedOrNewRpcInfos) {
        const measureData = await measureRpcSpeed(rpcInfo);
        setRpcSpeedMap((prev) => ({
          ...prev,
          [rpcInfo.networkId]: measureData,
        }));
      }
    },
    300,
  );
  useEffect(() => {
    if (customRpcData?.customRpcNetworks) {
      const currentRpcInfos = customRpcData.customRpcNetworks;
      const previousRpcInfos = previousRpcInfosRef.current || [];

      void updateRpcMeasureData({ currentRpcInfos, previousRpcInfos });

      previousRpcInfosRef.current = currentRpcInfos;
    }
  }, [customRpcData?.customRpcNetworks, updateRpcMeasureData]);

  const onAddOrEditRpc = useCallback(
    ({ network, rpcInfo }: IEditRpcParams) => {
      Dialog.show({
        renderContent: (
          <DialogContent network={network} rpcInfo={rpcInfo} onConfirm={run} />
        ),
      });
    },
    [run],
  );

  const showChainSelector = useConfigurableChainSelector();
  const onSelectNetwork = useCallback(
    (params?: { rpcInfo: ICustomRpcItem }) => {
      showChainSelector({
        networkIds: customRpcData?.supportNetworks?.map((i) => i.id),
        onSelect: (network: IServerNetwork) => {
          onAddOrEditRpc({ network, rpcInfo: params?.rpcInfo });
        },
      });
    },
    [showChainSelector, customRpcData?.supportNetworks, onAddOrEditRpc],
  );

  const onAddCustomRpc = useCallback(() => {
    onSelectNetwork();
  }, [onSelectNetwork]);

  const onDeleteCustomRpc = useCallback(
    async (item: ICustomRpcItem) => {
      await backgroundApiProxy.serviceCustomRpc.deleteCustomRpc(item.networkId);
      setTimeout(() => {
        void run();
      }, 200);
    },
    [run],
  );

  const onToggleCustomRpcEnabledState = useCallback(
    async (item: ICustomRpcItem) => {
      await backgroundApiProxy.serviceCustomRpc.addCustomRpc({
        rpc: item.rpc,
        networkId: item.networkId,
        enabled: !item.enabled,
      });
      setTimeout(() => {
        void run();
      }, 200);
    },
    [run],
  );

  const renderRpcStatus = useCallback(
    (item: ICustomRpcItem) => {
      if (!rpcSpeedMap[item.networkId] || rpcSpeedMap[item.networkId].loading) {
        return <Skeleton w={42} h="$5" />;
      }
      let badgeType = 'success';
      switch (rpcSpeedMap[item.networkId].status) {
        case ECustomStatus.Fast:
          badgeType = 'success';
          break;
        case ECustomStatus.Normal:
          badgeType = 'warning';
          break;
        case ECustomStatus.NotAvailable:
          badgeType = 'critical';
          break;
        default:
          break;
      }
      const text =
        rpcSpeedMap[item.networkId].status === ECustomStatus.NotAvailable
          ? 'Not Available'
          : `${rpcSpeedMap[item.networkId].responseTime}ms`;
      return (
        <Badge badgeType={badgeType} badgeSize="sm">
          {text}
        </Badge>
      );
    },
    [rpcSpeedMap],
  );

  const headerRight = useCallback(
    () =>
      Array.isArray(customRpcData?.customRpcNetworks) &&
      customRpcData.customRpcNetworks.length > 0 ? (
        <IconButton
          bg="$bgApp"
          icon="PlusCircleOutline"
          onPress={() => {
            onAddCustomRpc();
          }}
        />
      ) : null,
    [onAddCustomRpc, customRpcData?.customRpcNetworks],
  );

  if (!customRpcData?.customRpcNetworks) {
    return (
      <YStack flex={1} alignItems="center" justifyContent="center">
        <Spinner />
      </YStack>
    );
  }

  return (
    <Page>
      <Page.Header title="Custom RPC" headerRight={headerRight} />
      <Page.Body>
        <ListView
          data={customRpcData.customRpcNetworks}
          estimatedItemSize={60}
          keyExtractor={(item) => item.networkId}
          renderItem={({ item }) => (
            <ListItem>
              <XStack
                testID="CustomRpcItemContainer"
                flex={1}
                alignItems="center"
                justifyContent="space-between"
              >
                <XStack alignItems="center" space="$3" flexShrink={1}>
                  <Switch
                    value={item.enabled}
                    onChange={() => onToggleCustomRpcEnabledState(item)}
                  />
                  <TokenIconView
                    icon={item.network.logoURI}
                    networkId={item.networkId}
                  />
                  <YStack flexShrink={1}>
                    <XStack alignItems="center" space="$2">
                      <SizableText size="$bodyLgMedium" color="$text">
                        {item.network.name}
                      </SizableText>
                      {renderRpcStatus(item)}
                    </XStack>
                    <SizableText
                      size="$bodyMd"
                      color="$textSubdued"
                      numberOfLines={1}
                      flexShrink={1}
                    >
                      {item.rpc}
                    </SizableText>
                  </YStack>
                </XStack>
                <ActionList
                  title="More"
                  renderTrigger={
                    <IconButton icon="DotHorOutline" bg="$bgApp" />
                  }
                  items={[
                    {
                      label: 'Edit',
                      icon: 'PencilOutline',
                      onPress: () =>
                        onAddOrEditRpc({
                          network: item.network,
                          rpcInfo: item,
                        }),
                    },
                    {
                      label: 'Delete',
                      destructive: true,
                      icon: 'DeleteOutline',
                      onPress: async () => onDeleteCustomRpc(item),
                    },
                  ]}
                />
              </XStack>
            </ListItem>
          )}
          ListHeaderComponent={
            <ListHeaderComponent data={customRpcData.customRpcNetworks} />
          }
          ListEmptyComponent={
            <ListEmptyComponent onAddCustomRpc={() => onSelectNetwork()} />
          }
        />
      </Page.Body>
    </Page>
  );
}

export default CustomRPC;
