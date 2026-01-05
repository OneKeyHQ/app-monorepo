import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Button, useMedia } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { ListItem } from '../../../components/ListItem';
import { useAccountData } from '../../../hooks/useAccountData';

import { useBulkSendContext } from './BulkSendContext';
import { Token } from '../../../components/Token';

function AssetSelectorTrigger() {
  const intl = useIntl();
  const media = useMedia();
  const { selectedNetworkId, selectedToken } = useBulkSendContext();

  const { network } = useAccountData({
    networkId: selectedNetworkId,
  });

  const title = useMemo(() => {
    if (selectedToken) {
      return selectedToken.symbol;
    }

    return media.gtMd
      ? ''
      : intl.formatMessage({ id: ETranslations.token_selector_title });
  }, [selectedToken, media.gtMd, intl]);

  const handleSelectAsset = () => {};

  return (
    <ListItem
      drillIn={media.md}
      renderAvatar={() => (
        <Token
          tokenImageUri={selectedToken?.logoURI}
          size="lg"
          showNetworkIcon
          networkImageUri={network?.logoURI}
          networkId={network?.id}
        />
      )}
      title={title}
      subtitle={network?.name}
      bg="$bgSubdued"
      mx="$0"
      $gtMd={{
        px: '$0',
        bg: '$bgApp',
      }}
      onPress={media.gtMd ? undefined : handleSelectAsset}
    >
      {media.gtMd ? (
        <Button size="small" variant="secondary">
          {intl.formatMessage({
            id: ETranslations.send_to_contacts_selector_account_title,
          })}
        </Button>
      ) : null}
    </ListItem>
  );
}

export default AssetSelectorTrigger;
