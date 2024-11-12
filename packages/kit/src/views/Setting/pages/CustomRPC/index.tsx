import { useCallback, useEffect, useRef, useState } from 'react';

import { useIntl } from 'react-intl';
import { useDebouncedCallback } from 'use-debounce';

import type { IBadgeType } from '@onekeyhq/components';
import {
  ActionList,
  Badge,
  Dialog,
  Divider,
  ESwitchSize,
  Empty,
  Form,
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
  useForm,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { NetworkAvatar } from '@onekeyhq/kit/src/components/NetworkAvatar';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import useConfigurableChainSelector from '@onekeyhq/kit/src/views/ChainSelector/hooks/useChainSelector';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
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

function ListHeaderComponent() {
  const intl = useIntl();

  return (
    <>
      <SizableText px="$5" size="$bodyLg" color="$textSubdued">
        {intl.formatMessage({ id: ETranslations.custom_rpc_desc })}
      </SizableText>
      <Divider my="$5" />
    </>
  );
}

function ListEmptyComponent({
  onAddCustomRpc,
}: {
  onAddCustomRpc: () => void;
}) {
  const intl = useIntl();

  return (
    <Empty
      mt="$24"
      icon="BezierNodesOutline"
      title={intl.formatMessage({ id: ETranslations.custom_rpc_empty_title })}
      buttonProps={{
        onPress: () => onAddCustomRpc(),
        children: intl.formatMessage({
          id: ETranslations.custom_rpc_cta_label,
        }),
      }}
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
  const form = useForm<{ rpc: string }>({
    defaultValues: { rpc: rpcInfo?.rpc || '' },
  });
  const rpcValidRef = useRef(true);
  const [isLoading, setIsLoading] = useState(false);
  const intl = useIntl();

  return (
    <>
      <Dialog.Header>
        <Stack mb="$5">
          <NetworkAvatar networkId={network.id} size="$12" />
        </Stack>
        <Dialog.Title>
          {intl.formatMessage(
            { id: ETranslations.custom_rpc_edit_dialog_title },
            {
              network: network.name,
            },
          )}
        </Dialog.Title>
      </Dialog.Header>
      <Form form={form}>
        <Form.Field
          label="RPC URL"
          name="rpc"
          rules={{
            required: {
              value: true,
              message: intl.formatMessage({
                id: ETranslations.form_custom_rpc_error_invalid,
              }),
            },
            validate: (value) => {
              const errorMessage = intl.formatMessage({
                id: ETranslations.form_custom_rpc_error_invalid,
              });
              if (typeof value !== 'string') {
                return errorMessage;
              }
              const trimmedValue = value.trim();
              if (!trimmedValue) {
                return errorMessage;
              }
              if (!uriUtils.parseUrl(value) || !rpcValidRef.current) {
                return errorMessage;
              }
            },
          }}
        >
          <Input autoFocus flex={1} />
        </Form.Field>
      </Form>
      <Dialog.Footer
        onConfirm={async ({ preventClose, close }) => {
          const { serviceCustomRpc } = backgroundApiProxy;
          setIsLoading(true);
          const rpcUrl: string = form.getValues('rpc').trim();
          const networkId = network.id;
          try {
            rpcValidRef.current = true;
            await serviceCustomRpc.measureRpcStatus({
              rpcUrl,
              networkId,
              validateChainId: true,
            });
            await serviceCustomRpc.addCustomRpc({
              rpc: rpcUrl,
              networkId,
              enabled: rpcInfo?.enabled ?? true,
            });
            defaultLogger.setting.page.addCustomRPC({ network: networkId });
          } catch (e: any) {
            rpcValidRef.current = false;
            void form.trigger('rpc');
            preventClose();
            return;
          } finally {
            setIsLoading(false);
          }
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
  const intl = useIntl();
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
        status: responseTime < 800 ? ECustomStatus.Fast : ECustomStatus.Normal,
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
      const updateRpcSpeed = (
        networkId: string,
        measureData: IMeasureRpcItem,
      ) => {
        setRpcSpeedMap((prev) => ({
          ...prev,
          [networkId]: measureData,
        }));
      };
      const measurePromises = updatedOrNewRpcInfos.map(async (rpcInfo) => {
        const measureData = await measureRpcSpeed(rpcInfo);
        updateRpcSpeed(rpcInfo.networkId, measureData);
      });
      await Promise.all(measurePromises);
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
      defaultLogger.setting.page.deleteCustomRPC({ network: item.networkId });
      await backgroundApiProxy.serviceCustomRpc.deleteCustomRpc(item.networkId);
      setTimeout(() => {
        void run();
      }, 200);
    },
    [run],
  );

  const onToggleCustomRpcEnabledState = useCallback(
    async (item: ICustomRpcItem) => {
      await backgroundApiProxy.serviceCustomRpc.updateCustomRpcEnabledStatus({
        networkId: item.networkId,
        enabled: !item.enabled,
      });
      if (item.enabled) {
        defaultLogger.setting.page.turnOffCustomRPC({
          network: item.networkId,
        });
      } else {
        defaultLogger.setting.page.turnOnCustomRPC({ network: item.networkId });
      }
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
      let badgeType: IBadgeType = 'success';
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
          ? intl.formatMessage({ id: ETranslations.global_not_available })
          : `${rpcSpeedMap[item.networkId].responseTime}ms`;
      return (
        <Badge badgeType={badgeType} badgeSize="sm">
          {text}
        </Badge>
      );
    },
    [intl, rpcSpeedMap],
  );

  const headerRight = useCallback(
    () =>
      Array.isArray(customRpcData?.customRpcNetworks) &&
      customRpcData.customRpcNetworks.length > 0 ? (
        <IconButton
          title={intl.formatMessage({ id: ETranslations.custom_rpc_cta_label })}
          variant="tertiary"
          icon="PlusLargeOutline"
          onPress={() => {
            onAddCustomRpc();
          }}
        />
      ) : null,
    [customRpcData?.customRpcNetworks, intl, onAddCustomRpc],
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
      <Page.Header
        title={intl.formatMessage({ id: ETranslations.custom_rpc_title })}
        headerRight={headerRight}
      />
      <Page.Body>
        <ListView
          data={customRpcData.customRpcNetworks}
          estimatedItemSize={60}
          keyExtractor={(item) => item.networkId}
          renderItem={({ item }) => (
            <ListItem testID="CustomRpcItemContainer">
              <Switch
                disabled={item.isCustomNetwork}
                size={ESwitchSize.small}
                value={item.enabled}
                onChange={() => onToggleCustomRpcEnabledState(item)}
              />
              <NetworkAvatar networkId={item.networkId} size="$10" />
              <ListItem.Text
                flex={1}
                primary={
                  <XStack alignItems="center" gap="$2">
                    <SizableText
                      flexShrink={1}
                      numberOfLines={1}
                      size="$bodyLgMedium"
                      color="$text"
                    >
                      {item.network.name}
                    </SizableText>
                    {renderRpcStatus(item)}
                  </XStack>
                }
                secondary={item.rpc}
                secondaryTextProps={{
                  numberOfLines: 1,
                }}
              />
              <ActionList
                title={intl.formatMessage({ id: ETranslations.global_more })}
                renderTrigger={
                  <IconButton icon="DotHorOutline" variant="tertiary" />
                }
                items={[
                  {
                    label: intl.formatMessage({
                      id: ETranslations.global_edit,
                    }),
                    icon: 'PencilOutline',
                    onPress: () =>
                      onAddOrEditRpc({
                        network: item.network,
                        rpcInfo: item,
                      }),
                  },
                  {
                    label: intl.formatMessage({
                      id: ETranslations.global_delete,
                    }),
                    destructive: true,
                    icon: 'DeleteOutline',
                    onPress: async () => onDeleteCustomRpc(item),
                  },
                ]}
              />
            </ListItem>
          )}
          ListHeaderComponent={<ListHeaderComponent />}
          ListEmptyComponent={
            <ListEmptyComponent onAddCustomRpc={() => onSelectNetwork()} />
          }
        />
      </Page.Body>
    </Page>
  );
}

export default CustomRPC;
