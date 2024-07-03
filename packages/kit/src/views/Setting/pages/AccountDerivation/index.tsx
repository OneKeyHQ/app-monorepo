import { type FC } from 'react';

import { useIntl } from 'react-intl';

import { Page, SizableText, Stack, XStack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { DeriveTypeSelectorTriggerStandAlone } from '@onekeyhq/kit/src/components/AccountSelector/DeriveTypeSelectorTrigger';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { ETranslations } from '@onekeyhq/shared/src/locale';

type IAccountDerivationListItemProps = {
  title: string;
  icon?: string;
  networkId: string;
};

const offset = { mainAxis: -4, crossAxis: -10 };

const AccountDerivationListItem: FC<IAccountDerivationListItemProps> = ({
  title,
  icon,
  networkId,
}) => (
  <DeriveTypeSelectorTriggerStandAlone
    networkId={networkId}
    placement="bottom-end"
    offset={offset}
    renderTrigger={({ label }) => (
      <ListItem
        userSelect="none"
        title={title}
        avatarProps={{ src: icon, size: '$8' }}
      >
        <XStack>
          <SizableText mr="$3">{label}</SizableText>
          <ListItem.DrillIn name="ChevronDownSmallSolid" />
        </XStack>
      </ListItem>
    )}
  />
);

const AccountDerivation = () => {
  const {
    result: { items },
    isLoading,
  } = usePromiseResult(
    () => backgroundApiProxy.serviceSetting.getAccountDerivationConfig(),
    [],
    {
      initResult: { enabledNum: [], availableNetworksMap: {}, items: [] },
      watchLoading: true,
    },
  );
  const intl = useIntl();
  return (
    <Page scrollEnabled>
      <Page.Header
        title={intl.formatMessage({
          id: ETranslations.settings_account_derivation_path,
        })}
      />
      <Stack px="$5" py="$3">
        <SizableText size="$bodyLg">
          {intl.formatMessage({
            id: ETranslations.settings_account_derivation_path_desc,
          })}
        </SizableText>
      </Stack>
      {!isLoading ? (
        <Stack>
          {items.map((o) => (
            <AccountDerivationListItem
              key={o.icon}
              title={o.title}
              icon={o.icon}
              networkId={o.defaultNetworkId}
            />
          ))}
        </Stack>
      ) : null}
    </Page>
  );
};

export default AccountDerivation;
