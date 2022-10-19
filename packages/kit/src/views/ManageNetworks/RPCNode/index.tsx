import React, { FC, useCallback, useEffect, useMemo, useState } from 'react';

import { RouteProp, useRoute } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import {
  Button,
  Center,
  Collapse,
  DialogManager,
  GroupingList,
  HStack,
  Icon,
  ListItem,
  Modal,
  Typography,
} from '@onekeyhq/components';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useNetwork } from '../../../hooks';
import { updateCustomNetworkRpc } from '../../../store/reducers/settings';
import AddNodeDialog from '../components/AddNodeDialog';
import RestartAppDialog from '../components/RestartDialog';
import { RPCItem } from '../components/RPCItem';
import { MeasureResult, measureRpc, useRPCUrls } from '../hooks';
import { ManageNetworkRoutes, ManageNetworkRoutesParams } from '../types';

type RouteProps = RouteProp<
  ManageNetworkRoutesParams,
  ManageNetworkRoutes.RPCNode
>;

export const ManageNetworkRPCNode: FC = () => {
  const intl = useIntl();
  const route = useRoute<RouteProps>();
  const { networkId } = route.params;
  const [isEdit, setIsEdit] = useState(false);
  const { network } = useNetwork({ networkId });
  const { preset, custom, refresh } = useRPCUrls(network?.id);
  const [measureMap, setMeasureMap] = useState<{
    [url: string]: MeasureResult;
  }>({});

  const sort = useCallback(
    (rpcs: string[]) =>
      [...rpcs].sort(
        (a, b) =>
          (measureMap?.[a]?.responseTime ?? 100000) -
          (measureMap?.[b]?.responseTime ?? 100000),
      ),
    [measureMap],
  );

  const selectRpc = useCallback(
    (url: string) => {
      // restart required
      DialogManager.show({
        render: (
          <RestartAppDialog
            onConfirm={() => {
              backgroundApiProxy.serviceNetwork
                .updateNetwork(networkId, {
                  rpcURL: url,
                })
                .then(() => {
                  backgroundApiProxy.serviceApp.restartApp();
                });
            }}
          />
        ),
      });
    },
    [networkId],
  );

  const showAddNodeDialog = useCallback(() => {
    DialogManager.show({
      render: <AddNodeDialog networkId={networkId} onConfirm={refresh} />,
    });
  }, [networkId, refresh]);

  const toggleEditMode = useCallback(() => {
    setIsEdit(!isEdit);
  }, [isEdit]);

  const handleRemove = useCallback(
    (url: string) => {
      backgroundApiProxy.dispatch(
        updateCustomNetworkRpc({
          networkId,
          type: 'remove',
          rpc: url,
        }),
      );
      refresh();
    },
    [networkId, refresh],
  );

  const GroupingListData = useMemo(
    () => [
      {
        headerProps: {
          title: intl.formatMessage({ id: 'content__custom' }),
          actions: [
            {
              label: isEdit ? (
                intl.formatMessage({ id: 'action__done' })
              ) : (
                <HStack alignItems="center">
                  <Icon name="PencilSolid" size={16} />
                  <Typography.CaptionStrong ml="2">
                    {intl.formatMessage({ id: 'action__edit' })}
                  </Typography.CaptionStrong>
                </HStack>
              ),
              onPress: toggleEditMode,
            },
          ],
        },
        footerText: (
          <Center px="2" mt="4">
            <Button w="full" onPress={showAddNodeDialog}>
              {intl.formatMessage({ id: 'action__add_node' })}
            </Button>
          </Center>
        ),
        data: sort(custom),
      },
      {
        headerProps: {
          title: intl.formatMessage({ id: 'content__default' }),
        },
        data: sort(preset),
      },
    ],
    [custom, preset, intl, sort, showAddNodeDialog, isEdit, toggleEditMode],
  );

  useEffect(() => {
    preset.concat(custom).forEach((rpc) => {
      measureRpc(networkId, rpc).then((res) => {
        setMeasureMap((prev) => ({
          ...prev,
          [rpc]: res,
        }));
      });
    });
  }, [custom, preset, networkId]);

  return (
    <Modal
      header={intl.formatMessage({
        id: 'modal__rpc_node',
      })}
      height="560px"
      headerDescription={network?.name || ''}
      hideSecondaryAction
      hidePrimaryAction
    >
      <GroupingList
        ListHeaderComponent={() => (
          <Collapse
            trigger={
              <Typography.Body2Strong>
                {intl.formatMessage({ id: 'content__what_is_node_height' })}
              </Typography.Body2Strong>
            }
          >
            <Typography.Body2>
              {intl.formatMessage({
                id: 'content__what_is_node_height_desc',
              })}
            </Typography.Body2>
          </Collapse>
        )}
        sections={GroupingListData}
        renderItem={({ item }) => {
          const checked = item === network?.rpcURL;
          return (
            <ListItem
              flex={1}
              onPress={checked ? undefined : () => selectRpc(item)}
            >
              <ListItem.Column>
                <RPCItem
                  url={item}
                  measure={measureMap[item]}
                  checked={checked}
                  isEdit={isEdit}
                  canEdit={custom.includes(item) && !checked}
                  onRemove={handleRemove}
                />
              </ListItem.Column>
            </ListItem>
          );
        }}
        keyExtractor={(item: string, index) => `${item}_${index}`}
      />
    </Modal>
  );
};
