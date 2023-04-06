import type { FC } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useRoute } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import {
  Button,
  Center,
  Collapse,
  GroupingList,
  ListItem,
  Modal,
  Typography,
} from '@onekeyhq/components';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useNetwork } from '../../../hooks';
import { updateCustomNetworkRpc } from '../../../store/reducers/settings';
import { showDialog } from '../../../utils/overlayUtils';
import AddNodeDialog from '../components/AddNodeDialog';
// import RestartAppDialog from '../components/RestartDialog';
import { RPCItem } from '../components/RPCItem';
import { measureRpc, useRPCUrls } from '../hooks';

import type { MeasureResult } from '../hooks';
import type {
  ManageNetworkModalRoutes,
  ManageNetworkRoutesParams,
} from '../types';
import type { RouteProp } from '@react-navigation/native';

type RouteProps = RouteProp<
  ManageNetworkRoutesParams,
  ManageNetworkModalRoutes.RPCNode
>;

const HeaderCollapse = () => {
  const intl = useIntl();
  return (
    <Collapse
      trigger={
        <Typography.Body2Strong>
          {intl.formatMessage({ id: 'content__what_is_node_height' })}
        </Typography.Body2Strong>
      }
      pb="16px"
    >
      <Typography.Body2 px="8px" color="text-subdued">
        {intl.formatMessage({
          id: 'content__what_is_node_height_desc',
        })}
      </Typography.Body2>
    </Collapse>
  );
};

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
      backgroundApiProxy.serviceNetwork.updateNetwork(networkId, {
        rpcURL: url,
      });

      // **** restart required
      // showDialog({
      //   render: (
      //     <RestartAppDialog
      //       onConfirm={() => {
      //         backgroundApiProxy.serviceNetwork
      //           .updateNetwork(networkId, {
      //             rpcURL: url,
      //           })
      //           .then(() => {
      //             backgroundApiProxy.serviceApp.restartApp();
      //           });
      //       }}
      //     />
      //   ),
      // });
    },
    [networkId],
  );

  const showAddNodeDialog = useCallback(() => {
    showDialog(<AddNodeDialog networkId={networkId} onConfirm={refresh} />);
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

  const editCustomRpcButton = useMemo(() => {
    if (!custom.length) {
      return null;
    }
    return isEdit
      ? intl.formatMessage({ id: 'action__done' })
      : intl.formatMessage({ id: 'action__edit' });
  }, [custom, isEdit, intl]);

  const GroupingListData = useMemo(
    () => [
      {
        headerProps: {
          title: intl.formatMessage({ id: 'content__custom' }),
          actions: [
            {
              label: editCustomRpcButton,
              onPress: toggleEditMode,
            },
          ],
        },
        footerText: (
          <Center px="2" mt="4">
            <Button w="full" size="lg" onPress={showAddNodeDialog}>
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
    [
      custom,
      preset,
      intl,
      sort,
      showAddNodeDialog,
      toggleEditMode,
      editCustomRpcButton,
    ],
  );

  const measureRpcQueue = useCallback(
    (rpcs: string[]) => {
      let index = 0;
      let queueCount = 0;

      const startMeasure = (rpc: string) => {
        queueCount += 1;
        measureRpc(networkId, rpc, false)
          .then((res) => {
            setMeasureMap((prev) => ({
              ...prev,
              [rpc]: res,
            }));
          })
          .finally(() => {
            queueCount -= 1;
          });
      };

      const interval = setInterval(() => {
        while (queueCount < 3) {
          startMeasure(rpcs[index]);
          index += 1;
        }
        if (index >= rpcs.length) {
          clearInterval(interval);
          index = 0;
        }
      }, 600);
    },
    [networkId],
  );

  useEffect(() => {
    const timeout = setTimeout(() => {
      const rpcs = [...preset, ...custom];
      if (!rpcs.length) {
        return;
      }
      measureRpcQueue(rpcs);
    }, 1000);

    return () => clearTimeout(timeout);
  }, [custom, preset, measureRpcQueue]);

  return (
    <Modal
      header={intl.formatMessage({
        id: 'modal__rpc_node',
      })}
      height="560px"
      footer={null}
      headerDescription={network?.name || ''}
      hideSecondaryAction
      hidePrimaryAction
    >
      <GroupingList
        ListHeaderComponent={HeaderCollapse}
        stickySectionHeadersEnabled={false}
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
