import { useCallback, useMemo } from 'react';

import { Select, Spinner } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useDevSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  ONEKEY_API_HOST,
  ONEKEY_TEST_API_HOST,
} from '@onekeyhq/shared/src/config/appConfig';

export function IpTableSelector() {
  const [devSettings] = useDevSettingsPersistAtom();

  // Determine current domain based on test endpoint setting
  const currentDomain = useMemo(() => {
    if (devSettings.enabled && devSettings.settings?.enableTestEndpoint) {
      return ONEKEY_TEST_API_HOST;
    }
    return ONEKEY_API_HOST;
  }, [devSettings.enabled, devSettings.settings?.enableTestEndpoint]);

  // Fetch IP Table config
  const {
    result: ipTableData,
    isLoading,
    run: refreshConfig,
  } = usePromiseResult(
    async () => {
      const configWithRuntime =
        await backgroundApiProxy.serviceIpTable.getConfig();
      return configWithRuntime;
    },
    [],
    { watchLoading: true },
  );

  // Get current selection for this domain
  const currentSelection = useMemo(() => {
    if (!ipTableData?.runtime?.selections) {
      return '';
    }
    return ipTableData.runtime.selections[currentDomain] ?? '';
  }, [ipTableData?.runtime?.selections, currentDomain]);

  // Build select items
  const selectItems = useMemo(() => {
    const items: Array<{ label: string; value: string }> = [
      { label: 'Use Domain (Default)', value: '' },
    ];

    const domainConfig = ipTableData?.config?.domains?.[currentDomain];
    if (domainConfig?.endpoints) {
      domainConfig.endpoints.forEach((endpoint) => {
        items.push({
          label: `${endpoint.ip} (${endpoint.provider} - ${endpoint.region})`,
          value: endpoint.ip,
        });
      });
    }

    return items;
  }, [ipTableData?.config?.domains, currentDomain]);

  // Handle selection change
  const handleSelectionChange = useCallback(
    async (ip: string) => {
      await backgroundApiProxy.simpleDb.ipTable.updateSelection(
        currentDomain,
        ip,
      );
      // Refresh the config to update UI
      void refreshConfig();
    },
    [currentDomain, refreshConfig],
  );

  // Get display subtitle
  const subtitle = useMemo(() => {
    if (currentSelection === '') {
      return `Domain: ${currentDomain}`;
    }
    return `IP: ${currentSelection}`;
  }, [currentSelection, currentDomain]);

  if (isLoading) {
    return (
      <ListItem
        icon="GlobusOutline"
        title="IP Table Endpoint"
        subtitle="Loading..."
        titleProps={{ color: '$textCritical' }}
      >
        <Spinner size="small" />
      </ListItem>
    );
  }

  return (
    <ListItem
      icon="GlobusOutline"
      title="IP Table Endpoint"
      subtitle={subtitle}
      titleProps={{ color: '$textCritical' }}
    >
      <Select
        title="Select IP Endpoint"
        items={selectItems}
        value={currentSelection}
        onChange={handleSelectionChange}
        placement="bottom-end"
      />
    </ListItem>
  );
}
