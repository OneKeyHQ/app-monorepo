import { useCallback, useState } from 'react';

import { useIntl } from 'react-intl';

import { Button, Page, SizableText, Stack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';

import { downloadAsFile } from './downloadAsFile';

const CRLF = '\r\n';

const ExportCustomNetworkAndToken = () => {
  const intl = useIntl();
  const [loading, setLoading] = useState(false);
  const [empty, setEmpty] = useState(false);
  const onPress = useCallback(async () => {
    setLoading(true);
    try {
      const networkIncludeTokens =
        await backgroundApiProxy.serviceV4Migration.getV4CustomNetworkIncludeTokens();
      if (!networkIncludeTokens || networkIncludeTokens.length === 0) {
        setEmpty(true);
        return;
      }

      const data = networkIncludeTokens
        ?.map((o) => {
          let output = '';
          const chainId = networkUtils.parseNetworkId({
            networkId: o.network.id,
          }).chainId;
          output += `Network: ${o.network.name}${CRLF}`;
          output += `RPC URL: ${o.network.rpcURL}${CRLF}`;
          output += `Chain ID: ${chainId}${CRLF}`;
          output += `Symbol: ${o.network.symbol}${CRLF}`;
          if (o.network.explorerURL) {
            output += `Blockchain Explore URL: ${o.network.explorerURL}${CRLF}`;
          }
          const addresses = o.tokens.filter((item) => item.address);
          if (addresses.length > 0) {
            output += `${addresses
              .map((item) => `Token contract: ${item.address || '(empty)'}`)
              .join(CRLF)}${CRLF}`;
          }
          return output;
        })
        .join(`${CRLF}--${CRLF}`);
      // export output
      await downloadAsFile({
        content: data,
        filename: 'networks_and_tokens.txt',
      });
    } finally {
      setLoading(false);
    }
  }, []);
  return (
    <Stack>
      <SizableText size="$headingMd">
        {intl.formatMessage({
          id: ETranslations.settings_export_network_config_custom_network_label,
        })}
      </SizableText>
      <Stack h="$2" />
      <Button onPress={onPress} loading={loading} disabled={empty}>
        {!empty
          ? intl.formatMessage({ id: ETranslations.global_export })
          : intl.formatMessage({ id: ETranslations.global_no_data })}
      </Button>
    </Stack>
  );
};

const ExportCustomRPC = () => {
  const intl = useIntl();
  const [loading, setLoading] = useState(false);
  const [empty, setEmpty] = useState(false);
  const onPress = useCallback(async () => {
    try {
      const rpcUrlItems =
        await backgroundApiProxy.serviceV4Migration.getV4CustomRpcUrls();
      if (!rpcUrlItems || rpcUrlItems.length === 0) {
        setEmpty(true);
        return;
      }
      const content = rpcUrlItems
        .map((o) => {
          let output = '';
          output += `${o.networkName}${CRLF}`;
          output += `${o.rpcUrls.join(CRLF)}`;
          return output;
        })
        .join(`${CRLF}--${CRLF}`);
      // export output
      await downloadAsFile({ content, filename: 'rpc_urls.txt' });
    } finally {
      setLoading(false);
    }
  }, []);
  return (
    <Stack>
      <SizableText size="$headingMd">RPC</SizableText>
      <Stack h="$2" />
      <Button onPress={onPress} loading={loading} disabled={empty}>
        {!empty
          ? intl.formatMessage({ id: ETranslations.global_export })
          : intl.formatMessage({ id: ETranslations.global_no_data })}
      </Button>
    </Stack>
  );
};

const ExportCustomNetworkConfigPage = () => {
  const intl = useIntl();
  return (
    <Page>
      <Page.Header
        title={intl.formatMessage({
          id: ETranslations.settings_export_network_config_label,
        })}
      />
      <Page.Body>
        <Stack px="$5">
          <SizableText size="$bodyLg">
            {intl.formatMessage({
              id: ETranslations.settings_export_network_config_desc,
            })}
          </SizableText>
          <Stack h="$10" />
          <ExportCustomNetworkAndToken />
          <Stack h="$10" />
          <ExportCustomRPC />
        </Stack>
      </Page.Body>
    </Page>
  );
};

export default ExportCustomNetworkConfigPage;
