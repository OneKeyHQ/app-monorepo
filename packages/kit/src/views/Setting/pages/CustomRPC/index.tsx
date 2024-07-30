import { useCallback, useState } from 'react';

import {
  Button,
  Dialog,
  Divider,
  Empty,
  Input,
  ListView,
  Page,
  SizableText,
  Stack,
  XStack,
  YStack,
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

function ListHeaderComponent() {
  return (
    <SizableText px="$5" size="$bodyLg" color="$textSubdued">
      When modified, the custom RPC will replace OneKey’s node. To revert to
      OneKey’s node, disabled or delete the custom RPC.
    </SizableText>
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
          });
          setIsLoading(false);
        }}
        confirmButtonProps={{
          loading: isLoading,
        }}
      />
    </>
  );
}

function CustomRPC() {
  const { result: customRpcNetworks } = usePromiseResult(
    () => backgroundApiProxy.serviceNetwork.getCustomRpcEnabledNetworks(),
    [],
  );
  const showChainSelector = useConfigurableChainSelector();
  const onSelectNetwork = useCallback(() => {
    showChainSelector({
      networkIds: customRpcNetworks?.map((i) => i.id),
      onSelect: (network: IServerNetwork) => {
        Dialog.show({
          renderContent: <DialogContent network={network} />,
        });
      },
    });
  }, [showChainSelector, customRpcNetworks]);

  return (
    <Page>
      <Page.Header title="Custom RPC" />
      <Page.Body>
        <ListView
          data={[]}
          estimatedItemSize={60}
          keyExtractor={(item: string) => item}
          renderItem={({ item }) => (
            <ListItem>
              <SizableText>{item}</SizableText>
            </ListItem>
          )}
          ListHeaderComponent={ListHeaderComponent}
          ListEmptyComponent={
            <ListEmptyComponent onAddCustomRpc={() => onSelectNetwork()} />
          }
        />
      </Page.Body>
    </Page>
  );
}

export default CustomRPC;
