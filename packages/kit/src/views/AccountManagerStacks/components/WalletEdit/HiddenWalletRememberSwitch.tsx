import { useState } from 'react';

import { useIntl } from 'react-intl';

import type { IIconProps, ISizableTextProps } from '@onekeyhq/components';
import {
  ESwitchSize,
  Icon,
  Spinner,
  Stack,
  Switch,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src//background/instance/backgroundApiProxy';
import type { IListItemProps } from '@onekeyhq/kit/src/components/ListItem';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import type { IDBWallet } from '@onekeyhq/kit-bg/src/dbs/local/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';

function WalletOptionItem({
  label,
  description,
  icon,
  iconColor = '$iconSubdued',
  isLoading,
  children,
  drillIn,
  testID,
  ...rest
}: Omit<IListItemProps, 'icon'> & {
  label: ISizableTextProps['children'];
  description?: string;
  labelColor?: ISizableTextProps['color'];
  icon?: IIconProps['name'];
  iconColor?: IIconProps['color'];
  isLoading?: boolean;
  drillIn?: boolean;
  testID?: string;
}) {
  return (
    <ListItem userSelect="none" testID={testID} {...rest}>
      {icon ? (
        <Stack px="$2">
          <Icon name={icon} color={iconColor} />
        </Stack>
      ) : null}
      <ListItem.Text primary={label} secondary={description} flex={1} />
      {children}
      {isLoading ? <Spinner /> : null}
    </ListItem>
  );
}

export function HiddenWalletRememberSwitch({
  wallet,
}: {
  wallet: IDBWallet | undefined;
}) {
  const [val, setVal] = useState(!wallet?.isTemp);
  const intl = useIntl();

  return (
    <WalletOptionItem
      key={wallet?.id}
      label={intl.formatMessage({
        id: ETranslations.form_keep_hidden_wallet_label,
      })}
      description={intl.formatMessage({
        id: ETranslations.form_keep_hidden_wallet_label_desc,
      })}
      drillIn={false}
    >
      <Switch
        size={ESwitchSize.small}
        value={val}
        onChange={async () => {
          if (!wallet?.id) {
            return;
          }
          const newVal = !val;
          try {
            await backgroundApiProxy.serviceAccount.setWalletTempStatus({
              walletId: wallet?.id,
              isTemp: !newVal,
            });
            setVal(newVal);
          } catch (error) {
            setVal(val);
            throw error;
          }
        }}
      />
    </WalletOptionItem>
  );
}
