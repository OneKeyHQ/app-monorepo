import { useCallback, useEffect, useMemo, useState } from 'react';

import type { ICheckedState, ISizableTextProps } from '@onekeyhq/components';
import {
  Button,
  Checkbox,
  Dialog,
  Page,
  Select,
  SizableText as SizableTextBase,
  Spinner,
  Stack,
  Table,
  Tabs,
  Toast,
  XStack,
  YStack,
  useClipboard,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useOneKeyAuth } from '@onekeyhq/kit/src/components/OneKeyAuth/useOneKeyAuth';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useTabContainerWidth } from '@onekeyhq/kit/src/hooks/useTabContainerWidth';
import type { IDBCloudSyncItem } from '@onekeyhq/kit-bg/src/dbs/local/types';
import {
  useDevSettingsPersistAtom,
  useNotificationStatusAtom,
  usePrimeCloudSyncPersistAtom,
  usePrimeMasterPasswordPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { EPrimeCloudSyncDataType } from '@onekeyhq/shared/src/consts/primeConsts';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import dateUtils from '@onekeyhq/shared/src/utils/dateUtils';
import uriUtils from '@onekeyhq/shared/src/utils/uriUtils';
import type {
  ICloudSyncRawDataJson,
  ICloudSyncServerItemByDownloaded,
} from '@onekeyhq/shared/types/prime/primeCloudSyncTypes';
import type { IPrimeServerUserInfo } from '@onekeyhq/shared/types/prime/primeTypes';

type ITabType = 'local' | 'server';
type ISortField = 'dataType' | 'dataTime';
type ISortOrder = 'asc' | 'desc';

function SizableText({
  children,
  ...props
}: { children: React.ReactNode } & ISizableTextProps) {
  return (
    <SizableTextBase size="$bodySm" color="$textSubdued" {...props}>
      {children}
    </SizableTextBase>
  );
}

function shortSortIndex(sortIndex: number | undefined) {
  if (typeof sortIndex !== 'number') {
    return sortIndex;
  }
  return sortIndex.toFixed(2);
}

function getSortOrderLabel(sortOrder: ISortOrder | undefined) {
  if (sortOrder === 'desc') {
    return '↓';
  }
  if (sortOrder === 'asc') {
    return '↑';
  }
  return '';
}

function shortText(
  value: string | number | undefined | null,
  head = 18,
  tail = 12,
) {
  if (value === null || value === undefined || value === '') {
    return '-';
  }
  const text = String(value);
  if (text.length <= head + tail + 3) {
    return text;
  }
  return `${text.slice(0, head)}...${text.slice(-tail)}`;
}

type IRawDataSummary = {
  title: string;
  details: string[];
};

function buildRawDataSummary(
  rawDataJson: ICloudSyncRawDataJson | undefined,
): IRawDataSummary | null {
  if (!rawDataJson) {
    return null;
  }

  if (rawDataJson.dataType === EPrimeCloudSyncDataType.Lock) {
    return {
      title: rawDataJson.payload.message,
      details: [
        `cipher ${rawDataJson.payload.encryptedSecurityPasswordR1ForServer.length} chars`,
      ],
    };
  }

  if (rawDataJson.dataType === EPrimeCloudSyncDataType.Wallet) {
    return {
      title:
        rawDataJson.payload.name || rawDataJson.payload.walletType || 'Wallet',
      details: [
        [rawDataJson.payload.walletType || '-', rawDataJson.payload.avatar?.img]
          .filter(Boolean)
          .join(' >> '),
        rawDataJson.payload.passphraseState
          ? `passphrase ${rawDataJson.payload.passphraseState}`
          : undefined,
        rawDataJson.payload.walletHash
          ? `hash ${shortText(rawDataJson.payload.walletHash)}`
          : undefined,
        rawDataJson.payload.hwDeviceId
          ? `device ${shortText(rawDataJson.payload.hwDeviceId)}`
          : undefined,
      ].filter((item): item is string => Boolean(item)),
    };
  }

  if (rawDataJson.dataType === EPrimeCloudSyncDataType.BotWallet) {
    return {
      title:
        rawDataJson.payload.name || shortText(rawDataJson.payload.walletId),
      details: [
        `parent ${shortText(rawDataJson.payload.parentKeylessWalletId)}`,
        `index ${rawDataJson.payload.index}`,
        rawDataJson.payload.visible ? 'visible' : 'hidden',
        rawDataJson.payload.status,
      ],
    };
  }

  if (rawDataJson.dataType === EPrimeCloudSyncDataType.IndexedAccount) {
    return {
      title: rawDataJson.payload.name || `#${rawDataJson.payload.index}`,
      details: [
        `index ${rawDataJson.payload.index}`,
        shortText(rawDataJson.payload.walletXfp),
      ],
    };
  }

  if (rawDataJson.dataType === EPrimeCloudSyncDataType.Account) {
    return {
      title:
        rawDataJson.payload.name || shortText(rawDataJson.payload.accountId),
      details: [shortText(rawDataJson.payload.accountId, 20, 16)],
    };
  }

  if (rawDataJson.dataType === EPrimeCloudSyncDataType.BrowserBookmark) {
    const host =
      uriUtils.getHostNameFromUrl({ url: rawDataJson.payload.url }) ||
      rawDataJson.payload.url;
    return {
      title: rawDataJson.payload.title || host,
      details: [
        shortText(rawDataJson.payload.url, 24, 18),
        `sort ${shortSortIndex(rawDataJson.payload.sortIndex) ?? '-'}`,
      ],
    };
  }

  if (rawDataJson.dataType === EPrimeCloudSyncDataType.AddressBook) {
    return {
      title:
        rawDataJson.payload.addressBookItem.name ||
        shortText(rawDataJson.payload.addressBookItem.address),
      details: [
        rawDataJson.payload.addressBookItem.networkId,
        shortText(rawDataJson.payload.addressBookItem.address, 16, 12),
        rawDataJson.payload.addressBookItem.memo ||
          rawDataJson.payload.addressBookItem.note,
      ].filter((item): item is string => Boolean(item)),
    };
  }

  if (rawDataJson.dataType === EPrimeCloudSyncDataType.MarketWatchList) {
    if (rawDataJson.payload.perpsCoin) {
      return {
        title: rawDataJson.payload.perpsCoin,
        details: [
          'perps',
          `sort ${shortSortIndex(rawDataJson.payload.sortIndex) ?? '-'}`,
        ],
      };
    }
    return {
      title: rawDataJson.payload.isNative
        ? 'native'
        : shortText(rawDataJson.payload.contractAddress, 16, 12),
      details: [
        rawDataJson.payload.chainId,
        rawDataJson.payload.isNative
          ? 'native token'
          : shortText(rawDataJson.payload.contractAddress, 16, 12),
        `sort ${shortSortIndex(rawDataJson.payload.sortIndex) ?? '-'}`,
      ],
    };
  }

  if (rawDataJson.dataType === EPrimeCloudSyncDataType.CustomToken) {
    return {
      title:
        rawDataJson.payload.customToken.symbol ||
        rawDataJson.payload.customToken.name ||
        shortText(rawDataJson.payload.customToken.address),
      details: [
        rawDataJson.payload.customToken.name,
        rawDataJson.payload.customToken.networkId,
        shortText(rawDataJson.payload.customToken.address, 16, 12),
      ].filter((item): item is string => Boolean(item)),
    };
  }

  if (rawDataJson.dataType === EPrimeCloudSyncDataType.CustomNetwork) {
    return {
      title:
        rawDataJson.payload.customNetwork.name ||
        rawDataJson.payload.customNetwork.id,
      details: [
        rawDataJson.payload.customNetwork.id,
        `chainId ${rawDataJson.payload.customNetwork.chainId}`,
        shortText(rawDataJson.payload.customRpc.rpc, 24, 18),
      ],
    };
  }

  if (rawDataJson.dataType === EPrimeCloudSyncDataType.CustomRpc) {
    return {
      title:
        rawDataJson.payload.networkId || shortText(rawDataJson.payload.rpc),
      details: [
        shortText(rawDataJson.payload.rpc, 24, 18),
        rawDataJson.payload.enabled ? 'enabled' : 'disabled',
      ],
    };
  }

  return {
    // @ts-ignore
    title: rawDataJson?.dataType as string,
    details: [
      // @ts-ignore
      shortText(JSON.stringify(rawDataJson?.payload as unknown), 24, 18),
    ],
  };
}

function buildFallbackSummary(record: IDBCloudSyncItem): IRawDataSummary {
  return {
    title: '未解密',
    details: [
      record.dataType,
      shortText(record.rawKey || record.id),
      record.rawData
        ? shortText(record.rawData, 20, 16)
        : shortText(record.data, 20, 16),
    ],
  };
}

function buildDebugMessage(record: IDBCloudSyncItem) {
  if (record.rawDataJson) {
    return record.rawDataJson;
  }

  if (record.rawData) {
    try {
      return JSON.parse(record.rawData) as unknown;
    } catch {
      return record;
    }
  }

  return record;
}

function RawDataJsonView({
  rawDataJson,
}: {
  rawDataJson: ICloudSyncRawDataJson | undefined;
}) {
  if (!rawDataJson) {
    return null;
  }
  if (rawDataJson.dataType === EPrimeCloudSyncDataType.Wallet) {
    return (
      <SizableText>
        {[
          rawDataJson.payload.walletType,
          rawDataJson.payload.name,
          rawDataJson.payload.avatar?.img,
        ].join('>>')}
      </SizableText>
    );
  }
  if (rawDataJson.dataType === EPrimeCloudSyncDataType.BotWallet) {
    return (
      <SizableText>
        {[
          rawDataJson.payload.name,
          rawDataJson.payload.parentKeylessWalletId,
          rawDataJson.payload.index,
          rawDataJson.payload.status,
        ].join('>>')}
      </SizableText>
    );
  }
  if (rawDataJson.dataType === EPrimeCloudSyncDataType.IndexedAccount) {
    return (
      <SizableText>
        {[
          rawDataJson.payload.walletXfp,
          rawDataJson.payload.name,
          rawDataJson.payload.index,
        ].join('>>')}
      </SizableText>
    );
  }
  if (rawDataJson.dataType === EPrimeCloudSyncDataType.Account) {
    return (
      <SizableText>
        {[rawDataJson.payload.name, rawDataJson.payload.accountId].join('>>')}
      </SizableText>
    );
  }

  if (rawDataJson.dataType === EPrimeCloudSyncDataType.BrowserBookmark) {
    return (
      <SizableText>
        {[
          uriUtils.getHostNameFromUrl({ url: rawDataJson.payload.url }) ||
            rawDataJson.payload.url,
          shortSortIndex(rawDataJson.payload.sortIndex),
        ].join('>>')}
      </SizableText>
    );
  }

  if (rawDataJson.dataType === EPrimeCloudSyncDataType.AddressBook) {
    return (
      <SizableText>
        {[
          rawDataJson.payload.addressBookItem.networkId,
          rawDataJson.payload.addressBookItem.address,
        ].join('>>')}
      </SizableText>
    );
  }

  if (rawDataJson.dataType === EPrimeCloudSyncDataType.MarketWatchList) {
    return (
      <SizableText>
        {[
          rawDataJson.payload.chainId,
          rawDataJson.payload.contractAddress,
          rawDataJson.payload.isNative ? 'native' : '',
          shortSortIndex(rawDataJson.payload.sortIndex),
        ].join('>>')}
      </SizableText>
    );
  }

  if (rawDataJson.dataType === EPrimeCloudSyncDataType.CustomNetwork) {
    return (
      <SizableText>
        {[
          rawDataJson.payload.customNetwork.chainId,
          rawDataJson.payload.customNetwork.name,
          rawDataJson.payload.customRpc.rpc,
        ].join('>>')}
      </SizableText>
    );
  }

  if (rawDataJson.dataType === EPrimeCloudSyncDataType.CustomRpc) {
    return (
      <SizableText>
        {[rawDataJson.payload.rpc, rawDataJson.payload.enabled.toString()].join(
          '>>',
        )}
      </SizableText>
    );
  }

  return <SizableText>{JSON.stringify(rawDataJson)}</SizableText>;
}

function RawDataSummaryView({
  record,
  onPressTitle,
}: {
  record: IDBCloudSyncItem;
  onPressTitle: (record: IDBCloudSyncItem) => void;
}) {
  const summary =
    buildRawDataSummary(record.rawDataJson) || buildFallbackSummary(record);

  return (
    <YStack
      onPress={() => {
        onPressTitle(record);
      }}
    >
      <SizableText
        style={{ fontWeight: 'bold', textDecorationLine: 'underline' }}
        color="$textSuccess"
      >
        {summary.title}
      </SizableText>
      {summary.details.map((detail, index) => (
        <SizableText key={`${record.id}-summary-${index}`}>
          {detail}
        </SizableText>
      ))}
    </YStack>
  );
}

function SyncItemTable({ activeTab }: { activeTab: ITabType }) {
  const { copyText } = useClipboard();
  const [isLoading, setIsLoading] = useState(false);
  const [syncItems, setSyncItems] = useState<IDBCloudSyncItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedDataType, setSelectedDataType] = useState<
    EPrimeCloudSyncDataType | '$ALL'
  >('$ALL');
  const [sortState, setSortState] = useState<{
    field?: ISortField;
    order?: ISortOrder;
  }>({
    field: 'dataTime',
    order: 'desc',
  });

  const [includingServerDeleted, setIncludingServerDeleted] = useState(false);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      let items: IDBCloudSyncItem[] = [];
      if (activeTab === 'local') {
        items =
          await backgroundApiProxy.servicePrimeCloudSync.decryptAllLocalSyncItems();
      } else {
        items =
          await backgroundApiProxy.servicePrimeCloudSync.decryptAllServerSyncItems(
            {
              includeDeleted: includingServerDeleted,
            },
          );
      }
      setSyncItems(items || []);
    } catch (err) {
      console.error('获取数据失败', err);
      setError(err instanceof Error ? err.message : '未知错误');
      setSyncItems([]);
    } finally {
      setIsLoading(false);
    }
  }, [activeTab, includingServerDeleted]);

  useEffect(() => {
    if (activeTab) {
      void fetchData();
    }
  }, [activeTab, fetchData]);

  const filteredItems = useMemo(() => {
    if (selectedDataType === '$ALL') return syncItems;
    return syncItems.filter((item) => item.dataType === selectedDataType);
  }, [syncItems, selectedDataType]);

  const displayItems = useMemo(() => {
    if (!sortState.field || !sortState.order) {
      return filteredItems;
    }

    return [...filteredItems].toSorted((a, b) => {
      if (sortState.field === 'dataType') {
        const compareResult = a.dataType.localeCompare(b.dataType);
        return sortState.order === 'desc' ? -compareResult : compareResult;
      }

      const timeA = a.dataTime ?? 0;
      const timeB = b.dataTime ?? 0;

      if (timeA === timeB) {
        return a.id.localeCompare(b.id);
      }

      return sortState.order === 'desc' ? timeB - timeA : timeA - timeB;
    });
  }, [filteredItems, sortState.field, sortState.order]);

  const openRawDataJsonDialog = useCallback((record: IDBCloudSyncItem) => {
    Dialog.debugMessage({
      title: `${record.dataType} JSON`,
      debugMessage: buildDebugMessage(record),
    });
  }, []);

  const openRecordDialog = useCallback((record: IDBCloudSyncItem) => {
    console.log('row data', record);
    Dialog.debugMessage({
      debugMessage: record,
    });
  }, []);

  const toggleSortBy = useCallback((field: ISortField) => {
    setSortState((prev) => {
      if (prev.field !== field || !prev.order) {
        return {
          field,
          order: 'asc',
        };
      }

      if (prev.order === 'asc') {
        return {
          field,
          order: 'desc',
        };
      }

      return {};
    });
  }, []);

  const dataTypeSortOrder =
    sortState.field === 'dataType' ? sortState.order : undefined;
  const timeSortOrder =
    sortState.field === 'dataTime' ? sortState.order : undefined;

  const columns = useMemo(
    () => [
      {
        title: (
          <XStack
            ai="center"
            gap="$1"
            cursor="pointer"
            onPress={() => {
              toggleSortBy('dataType');
            }}
          >
            <SizableText
              style={{ fontWeight: 'bold' }}
              color={dataTypeSortOrder ? '$textSuccess' : '$textSubdued'}
            >
              dataType/key/data
            </SizableText>
            <SizableText
              style={{ fontWeight: 'bold' }}
              color={dataTypeSortOrder ? '$textSuccess' : '$textSubdued'}
            >
              {getSortOrderLabel(dataTypeSortOrder)}
            </SizableText>
          </XStack>
        ),
        dataIndex: 'id',
        columnWidth: 150,
        render: (text: string, record: IDBCloudSyncItem) => (
          <YStack
            onPress={() => {
              openRecordDialog(record);
            }}
          >
            <SizableText style={{ fontWeight: 'bold' }} color="$textSuccess">
              {record.dataType}
            </SizableText>
            <SizableText style={{ fontWeight: 'bold' }} color="$textSubdued">
              {text.slice(0, 10)}...
            </SizableText>
            <SizableText color="$textSubdued">
              {record.data ? `...${record.data.slice(-10)}` : ''}
            </SizableText>
          </YStack>
        ),
      },
      {
        title: '解密字段',
        dataIndex: 'rawDataJson',
        columnWidth: 260,
        render: (_text: ICloudSyncRawDataJson, record: IDBCloudSyncItem) => (
          <RawDataSummaryView
            record={record}
            onPressTitle={openRawDataJsonDialog}
          />
        ),
      },
      {
        title: (
          <XStack
            ai="center"
            gap="$1"
            cursor="pointer"
            onPress={() => {
              toggleSortBy('dataTime');
            }}
          >
            <SizableText
              style={{ fontWeight: 'bold' }}
              color={timeSortOrder ? '$textSuccess' : '$textSubdued'}
            >
              更新时间
            </SizableText>
            <SizableText
              style={{ fontWeight: 'bold' }}
              color={timeSortOrder ? '$textSuccess' : '$textSubdued'}
            >
              {getSortOrderLabel(timeSortOrder)}
            </SizableText>
          </XStack>
        ),
        dataIndex: 'dataTime',
        columnWidth: 240,
        render: (text: number, record: IDBCloudSyncItem) => (
          <YStack
            onPress={() => {
              openRecordDialog(record);
            }}
          >
            <SizableText style={{ fontWeight: 'bold' }} color="$textSuccess">
              {dateUtils.formatDate(new Date(text), {
                formatTemplate: 'yyyy/LL/dd, HH:mm:ss',
              })}
            </SizableText>
            <SizableText color="$textSubdued">{record.rawKey}</SizableText>
            <SizableText color="$textSubdued">
              <RawDataJsonView rawDataJson={record.rawDataJson} />
            </SizableText>
          </YStack>
        ),
      },
    ],
    [
      dataTypeSortOrder,
      openRawDataJsonDialog,
      openRecordDialog,
      timeSortOrder,
      toggleSortBy,
    ],
  );

  return (
    <YStack flex={1} minHeight={0} p="$1" gap="$1">
      <XStack gap="$1" alignItems="center">
        <Select
          title="数据类型"
          value={selectedDataType}
          onChange={(value) =>
            setSelectedDataType(value as EPrimeCloudSyncDataType)
          }
          items={[
            { label: '全部', value: '$ALL' },
            { label: 'Lock', value: EPrimeCloudSyncDataType.Lock },
            { label: 'Wallet', value: EPrimeCloudSyncDataType.Wallet },
            { label: 'BotWallet', value: EPrimeCloudSyncDataType.BotWallet },
            {
              label: 'IndexedAccount',
              value: EPrimeCloudSyncDataType.IndexedAccount,
            },
            { label: 'Account', value: EPrimeCloudSyncDataType.Account },
            {
              label: 'BrowserBookmark',
              value: EPrimeCloudSyncDataType.BrowserBookmark,
            },
            {
              label: 'AddressBook',
              value: EPrimeCloudSyncDataType.AddressBook,
            },
            {
              label: 'MarketWatchList',
              value: EPrimeCloudSyncDataType.MarketWatchList,
            },
            {
              label: 'CustomNetwork',
              value: EPrimeCloudSyncDataType.CustomNetwork,
            },
            { label: 'CustomRpc', value: EPrimeCloudSyncDataType.CustomRpc },
            {
              label: 'CustomToken',
              value: EPrimeCloudSyncDataType.CustomToken,
            },
          ]}
        />
        <Stack flex={1} />
        <Button
          onPress={async () => {
            await backgroundApiProxy.servicePrimeCloudSync.clearAllLocalSyncItems();
            Toast.success({
              title: 'success',
            });
          }}
        >
          清空本地同步数据
        </Button>
        <Button
          size="small"
          onPress={() => {
            // 复制 filteredItems
            const itemsStr = JSON.stringify(displayItems, null, 2);
            copyText(itemsStr);
            Toast.success({
              title: `已复制 ${displayItems.length} 条数据`,
            });
          }}
        >
          复制结果
        </Button>
      </XStack>
      <XStack gap="$1" alignItems="center">
        <SizableText>{displayItems?.length}条</SizableText>
        <Stack flex={1} />
        {activeTab === 'server' ? (
          <Checkbox
            label="包含已删除数据"
            value={includingServerDeleted}
            onChange={(v: ICheckedState) =>
              setIncludingServerDeleted(v === true)
            }
          />
        ) : null}
        <Button loading={isLoading} size="small" onPress={fetchData}>
          刷新
        </Button>
      </XStack>
      {error ? <SizableText color="$textCritical">{error}</SizableText> : null}
      {!displayItems?.length ? <SizableText>无数据</SizableText> : null}
      <Table
        columns={columns}
        dataSource={displayItems}
        estimatedItemSize={40}
        keyExtractor={(item) => item.id}
        tabIntegrated
      />
    </YStack>
  );
}

function StatusPanel() {
  const { user } = useOneKeyAuth();
  const [cloudSyncStatus] = usePrimeCloudSyncPersistAtom();
  const [localMasterPasswordInfo] = usePrimeMasterPasswordPersistAtom();
  const [devSettings] = useDevSettingsPersistAtom();
  const [primeMasterPasswordInfo] = usePrimeMasterPasswordPersistAtom();
  const [loading, setLoading] = useState(false);
  const [notificationStatus] = useNotificationStatusAtom();

  const { result } = usePromiseResult(async () => {
    setLoading(true);

    let lock: ICloudSyncServerItemByDownloaded | undefined;
    let serverUserInfo: IPrimeServerUserInfo | undefined;
    let serverLockItem: IDBCloudSyncItem | undefined | null;
    let cachePassword: string | undefined;
    let randomIdInfo: { uuid: string } | undefined;

    try {
      try {
        randomIdInfo =
          await backgroundApiProxy.servicePrime.apiFetchServerRandomIdInfo();
      } catch (error) {
        console.error('获取随机ID失败', error);
      }

      try {
        serverUserInfo =
          await backgroundApiProxy.servicePrime.callApiFetchPrimeUserInfo();
      } catch (error) {
        console.error('获取用户信息失败', error);
      }

      try {
        ({ lock } =
          await backgroundApiProxy.servicePrimeCloudSync.apiFetchSyncLock());
      } catch (error) {
        console.error('获取云端密码失败', error);
      }

      if (lock && serverUserInfo) {
        try {
          serverLockItem =
            await backgroundApiProxy.servicePrimeCloudSync.decodeServerLockItem(
              {
                lockItem: lock,
                serverUserInfo,
              },
            );
        } catch (error) {
          console.error('解码云端密码失败', error);
        }
      }

      try {
        cachePassword =
          await backgroundApiProxy.servicePassword.getCachedPassword();
      } catch (error) {
        console.error('获取锁屏密码失败', error);
      }
    } finally {
      setLoading(false);
    }

    return {
      lock,
      randomIdInfo,
      serverUserInfo,
      serverLockItem,
      cachePassword,
    };
  }, []);

  const renderTestItem = useCallback(
    ({
      title,
      checkValue,
    }: {
      title: string;
      checkValue: boolean | undefined | 'TODO';
    }) => {
      return (
        <XStack gap="$2" h="$5">
          <SizableText>{title}</SizableText>
          {loading ? (
            <Spinner size="small" />
          ) : (
            <SizableText>
              {(() => {
                if (checkValue === 'TODO') return '⚠️';
                return checkValue ? '✅' : '❌';
              })()}
            </SizableText>
          )}
        </XStack>
      );
    },
    [loading],
  );

  return (
    <YStack p="$4" gap="$2">
      {renderTestItem({
        title: '网络和梯子正常',
        checkValue: !!result?.randomIdInfo?.uuid,
      })}
      {renderTestItem({
        title: '服务器测试网络节点已启用',
        checkValue:
          devSettings?.enabled && devSettings?.settings?.enableTestEndpoint,
      })}
      {renderTestItem({
        title: '锁屏密码已缓存',
        checkValue: !!result?.cachePassword,
      })}
      {renderTestItem({
        title: 'OneKeyID 已登录',
        checkValue: !!user?.onekeyUserId,
      })}
      {renderTestItem({
        title: 'Prime 已付费，且订阅未过期',
        checkValue: !!user?.primeSubscription?.isActive,
      })}
      {renderTestItem({
        title: '主密码(同步密码)已缓存',
        checkValue: !!(
          primeMasterPasswordInfo.masterPasswordUUID &&
          primeMasterPasswordInfo.encryptedSecurityPasswordR1
        ),
      })}
      {renderTestItem({
        title: '云端同步已开启',
        checkValue: cloudSyncStatus.isCloudSyncEnabled,
      })}
      {renderTestItem({
        title: '系统时间正常',
        checkValue: 'TODO',
      })}
      {renderTestItem({
        title: 'WebSocket 已连接',
        checkValue: notificationStatus?.websocketConnected,
      })}
      <SizableText>
        localPwdHash: {localMasterPasswordInfo.masterPasswordUUID}
      </SizableText>
      <SizableText>
        serverPwdHash: {result?.serverUserInfo?.pwdHash}
      </SizableText>
      <SizableText>
        serverLockItem:{' '}
        {JSON.stringify({
          dataType: result?.serverLockItem?.dataType,
          key: `${result?.serverLockItem?.id?.slice(0, 10) || ''}...`,
          data: `${result?.serverLockItem?.data?.slice(0, 10) || ''}...`,
          payload: result?.serverLockItem?.rawDataJson?.payload ?? '--',
        })}
      </SizableText>
      <SizableText>
        localLockItem:{JSON.stringify(localMasterPasswordInfo)}
      </SizableText>
    </YStack>
  );
}

function ScenarioPanel() {
  const [config] = usePrimeCloudSyncPersistAtom();
  return (
    <YStack p="$4" gap="$2">
      <SizableTextBase size="$bodyMdMedium">
        Current: isCloudSyncEnabled={String(!!config.isCloudSyncEnabled)},
        isCloudSyncEnabledKeyless=
        {String(!!config.isCloudSyncEnabledKeyless)}
      </SizableTextBase>
      <Button
        size="small"
        onPress={async () => {
          await backgroundApiProxy.servicePrimeCloudSync.toggleCloudSync({
            enabled: !config.isCloudSyncEnabled,
          });
          Toast.success({ title: `ID sync → ${!config.isCloudSyncEnabled}` });
        }}
      >
        Toggle isCloudSyncEnabled (ID)
      </Button>
      <Button
        size="small"
        onPress={async () => {
          await backgroundApiProxy.serviceKeylessCloudSync.toggleCloudSyncKeyless(
            { enabled: !config.isCloudSyncEnabledKeyless },
          );
          Toast.success({
            title: `KW sync → ${!config.isCloudSyncEnabledKeyless}`,
          });
        }}
      >
        Toggle isCloudSyncEnabledKeyless (KW)
      </Button>
    </YStack>
  );
}

function DebugPanel() {
  return (
    <YStack p="$4" gap="$2">
      <Button
        mt="$4"
        onPress={() => {
          void backgroundApiProxy.servicePassword.promptPasswordVerify({});
        }}
      >
        激活锁屏密码
      </Button>
      <Stack h="$8" />
      <Button
        mt="$4"
        onPress={() => {
          void backgroundApiProxy.servicePrimeCloudSync.demoCopyDevice();
        }}
      >
        copyDevice
      </Button>
      <Button
        onPress={async () => {
          await backgroundApiProxy.servicePrimeCloudSync.clearAllLocalSyncItems();
          Toast.success({
            title: 'success',
          });
        }}
      >
        清空本地同步数据
      </Button>
      <Button
        onPress={async () => {
          await backgroundApiProxy.servicePrimeCloudSync.resetServerData({
            skipPrimeStatusCheck: true,
          });
          Toast.success({
            title: 'success',
          });
        }}
      >
        清空云端同步数据和密码
      </Button>
      <Button
        onPress={async () => {
          await backgroundApiProxy.serviceMasterPassword.clearLocalMasterPassword();
          Toast.success({
            title: 'success',
          });
        }}
      >
        清空本地主密码
      </Button>
      <Button
        onPress={async () => {
          await backgroundApiProxy.serviceMasterPassword.clearLocalMasterPassword(
            {
              skipDisableCloudSync: true,
            },
          );
          Toast.success({
            title: 'success',
          });
        }}
      >
        清空本地主密码，不关闭云同步
      </Button>
      <Button
        onPress={async () => {
          await backgroundApiProxy.servicePrimeCloudSync.demoClearSyncItemPwdHash();
          Toast.success({
            title: 'success',
            message: '清理完成后，在另一个客户端上修改主密码，然后同步',
          });
        }}
      >
        清空本地数据的 pwdHash
      </Button>
      <Button
        onPress={async () => {
          await backgroundApiProxy.servicePrimeCloudSync.demoTamperingLocalSyncItemData();
          Toast.success({
            title: 'success',
          });
        }}
      >
        篡改本地数据 data
      </Button>
      <Button
        onPress={async () => {
          await backgroundApiProxy.servicePrimeCloudSync.demoTamperingLocalSyncItemDataTime();
          Toast.success({
            title: 'success',
          });
        }}
      >
        篡改本地数据 dataTime
      </Button>
      <Button
        onPress={async () => {
          await backgroundApiProxy.simpleDb.appStatus.setRawData({});
          const { password } =
            await backgroundApiProxy.servicePassword.promptPasswordVerify({});
          await backgroundApiProxy.serviceAccount.generateAllHdAndQrWalletsHashAndXfp(
            {
              password,
            },
          );
        }}
      >
        生成 HD 钱包 hash 和 xfp
      </Button>
      <Button
        onPress={async () => {
          await backgroundApiProxy.serviceAccount.clearAllWalletHashAndXfp();
          Toast.success({
            title: 'success',
          });
        }}
      >
        清除所有钱包 hash 和 xfp
      </Button>
      <Button
        onPress={async () => {
          await backgroundApiProxy.servicePrimeCloudSync.syncToSceneByAllPendingItems();
          Toast.success({
            title: 'success',
          });
        }}
      >
        写入同步数据到本地
      </Button>
    </YStack>
  );
}

export default function PagePrimeCloudSyncDebug() {
  const tabContainerWidth = useTabContainerWidth();

  const localItemsTable = useCallback(
    () => <SyncItemTable activeTab="local" />,
    [],
  );

  const serverItemsTable = useCallback(
    () => <SyncItemTable activeTab="server" />,
    [],
  );

  const statusPanel = useCallback(() => {
    return (
      <Tabs.ScrollView showsVerticalScrollIndicator={false}>
        <StatusPanel />
      </Tabs.ScrollView>
    );
  }, []);

  const debugPanel = useCallback(() => {
    return (
      <Tabs.ScrollView showsVerticalScrollIndicator={false}>
        <DebugPanel />
      </Tabs.ScrollView>
    );
  }, []);

  const scenarioPanel = useCallback(() => {
    return (
      <Tabs.ScrollView showsVerticalScrollIndicator={false}>
        <ScenarioPanel />
      </Tabs.ScrollView>
    );
  }, []);

  const tabs = useMemo(() => {
    return [
      {
        title: '本地数据',
        page: localItemsTable,
      },
      {
        title: '云端数据',
        page: serverItemsTable,
      },
      {
        title: '状态检查',
        page: statusPanel,
      },
      {
        title: '调试面板',
        page: debugPanel,
      },
      {
        title: 'Scenarios',
        page: scenarioPanel,
      },
    ];
  }, [
    debugPanel,
    localItemsTable,
    scenarioPanel,
    serverItemsTable,
    statusPanel,
  ]);

  return (
    <Page>
      <Page.Header title="云同步数据调试" />
      <Page.Body>
        <Stack flex={1} minHeight={0}>
          <Tabs.Container
            width={platformEnv.isNative ? Number(tabContainerWidth) : undefined}
            renderTabBar={(props) => <Tabs.TabBar {...props} />}
          >
            {tabs.map((tab) => (
              <Tabs.Tab key={tab.title} name={tab.title}>
                {tab.page()}
              </Tabs.Tab>
            ))}
          </Tabs.Container>
        </Stack>
      </Page.Body>
    </Page>
  );
}
