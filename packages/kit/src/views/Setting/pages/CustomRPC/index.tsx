import { useCallback, useMemo, useState } from 'react';

import {
  Button,
  Dialog,
  Divider,
  Empty,
  Form,
  Input,
  ListView,
  Page,
  SizableText,
  XStack,
  YStack,
  useForm,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { TokenIconView } from '@onekeyhq/kit/src/components/TokenListView/TokenIconView';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import useConfigurableChainSelector from '@onekeyhq/kit/src/views/ChainSelector/hooks/useChainSelector';
import {
  getNetworkIds,
  getNetworkIdsMap,
} from '@onekeyhq/shared/src/config/networkIds';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
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

function CustomRPC() {
  const content = useMemo(() => [], []);

  const [isLoading, setIsLoading] = useState(false);
  const [networkId, setNetworkId] = useState<string>();
  const showChainSelector = useConfigurableChainSelector();
  const { result: customRpcNetworks } = usePromiseResult(
    () => backgroundApiProxy.serviceNetwork.getCustomRpcEnabledNetworks(),
    [],
  );
  const onSelectNetwork = useCallback(() => {
    showChainSelector({
      networkIds: customRpcNetworks?.map((i) => i.id),
      onSelect: (network: IServerNetwork) => {
        Dialog.show({
          renderContent: (
            <>
              <Dialog.Header>
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
            </>
          ),
          onConfirm: async (values) => {
            setIsLoading(true);
            await timerUtils.wait(2000);
            console.log('====>>>values: ', values);
            setIsLoading(false);
          },
          confirmButtonProps: {
            loading: isLoading,
          },
        });
      },
    });
  }, [showChainSelector, customRpcNetworks, isLoading]);

  return (
    <Page>
      <Page.Header title="Custom RPC" />
      <Page.Body>
        <ListView
          data={content}
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
