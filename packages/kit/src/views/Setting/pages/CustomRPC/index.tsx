import { useCallback, useState } from 'react';

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
  Stack,
  Spinner,
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

function DialogContent({ network }: { network: IServerNetwork }) {
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
          defaultValues: { rpc: '' },
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
            enabled: true,
          });
          setIsLoading(false);
          await close();
        }}
        confirmButtonProps={{
          loading: isLoading,
        }}
      />
    </>
  );
}

function CustomRPC() {
  const { result: customRpcData, isLoading } = usePromiseResult(
    async () => {
      const { serviceNetwork, serviceCustomRpc } = backgroundApiProxy;
      const _supportNetworks =
        await serviceNetwork.getCustomRpcEnabledNetworks();
      const _customRpcNetworks = await serviceCustomRpc.getAllCustomRpc();
      return {
        supportNetworks: _supportNetworks,
        customRpcNetworks: _customRpcNetworks,
      };
    },
    [],
    {
      watchLoading: true,
    },
  );
  const showChainSelector = useConfigurableChainSelector();
  const onSelectNetwork = useCallback(() => {
    showChainSelector({
      networkIds: customRpcData?.supportNetworks?.map((i) => i.id),
      onSelect: (network: IServerNetwork) => {
        Dialog.show({
          renderContent: <DialogContent network={network} />,
        });
      },
    });
  }, [showChainSelector, customRpcData?.supportNetworks]);

  if (isLoading || !customRpcData?.customRpcNetworks) {
    return (
      <YStack flex={1} alignItems="center" justifyContent="center">
        <Spinner />
      </YStack>
    );
  }

  return (
    <Page>
      <Page.Header title="Custom RPC" />
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
                <XStack alignItems="center" space="$3">
                  <Switch
                    value={item.enabled}
                    onChange={() => {
                      void backgroundApiProxy.serviceCustomRpc.addCustomRpc({
                        rpc: item.rpc,
                        networkId: item.networkId,
                        enabled: !item.enabled,
                      });
                    }}
                  />
                  <TokenIconView
                    icon={item.network.logoURI}
                    networkId={item.networkId}
                  />
                  <YStack>
                    <XStack alignItems="center" space="$2">
                      <SizableText size="$bodyLgMedium" color="$text">
                        {item.network.name}
                      </SizableText>
                      <Badge badgeType="success" badgeSize="sm">
                        3400ms
                      </Badge>
                    </XStack>
                    <SizableText size="$bodyMd" color="$textSubdued">
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
                      onPress: () => {
                        console.log('action1');
                      },
                    },
                    {
                      label: 'Delete',
                      destructive: true,
                      icon: 'DeleteOutline',
                      onPress: () => {
                        console.log('action2');
                      },
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
