import { useCallback, useState } from 'react';

import { useIntl } from 'react-intl';

import { Button, Page, SizableText, Stack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ETranslations } from '@onekeyhq/shared/src/locale';

const CRLF = '\r\n';

const ExportCustomNetworkAndToken = () => {
  const intl = useIntl();
  const [loading, setLoading] = useState(false);
  const [empty, setEmpty] = useState(false);
  const onPress = useCallback(async () => {
    const networkIncludeTokens =
      await backgroundApiProxy.serviceV4Migration.getV4CustomNetworkIncludeTokens();
    if (!networkIncludeTokens || networkIncludeTokens.length === 0) {
      setEmpty(true);
      return;
    }

    const data = networkIncludeTokens
      ?.map((o) => {
        let output = '';
        output += `Network: ${o.network.name}${CRLF}`;
        output += `RPC URL: ${o.network.rpcURL}${CRLF}`;
        output += `Chain ID: ${o.network.id}${CRLF}`;
        output += `Symbol: ${o.network.symbol}${CRLF}`;
        if (o.network.explorerURL) {
          output += `Blockchain Explore URL: ${o.network.explorerURL}${CRLF}`;
        }
        const addresses = o.tokens.filter((item) => item.address);
        if (addresses.length > 0) {
          output += addresses
            .map((item) => `Token contract: ${item.address || '(empty)'}`)
            .join(CRLF);
        }
        return output;
      })
      .join('--');
    // export output
    console.log(data);
  }, []);
  return (
    <Stack>
      <SizableText size="$headingMd">
        {intl.formatMessage({
          id: ETranslations.settings_export_network_config_custom_network_label,
        })}
      </SizableText>
      <Stack h="$2" />
      <Button onPress={onPress}>
        {intl.formatMessage({ id: ETranslations.global_export })}
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
      if (!rpcUrlItems) {
        setEmpty(true);
      }
      const output = rpcUrlItems
        ?.map((o) => `${o.networkName}${CRLF}${o.rpcUrls.join(CRLF)}`)
        .join('--');
      // export output
      console.log(output);
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
