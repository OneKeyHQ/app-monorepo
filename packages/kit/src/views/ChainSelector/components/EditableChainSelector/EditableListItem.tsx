import { useCallback, useContext, useMemo } from 'react';

import BigNumber from 'bignumber.js';
import { isUndefined } from 'lodash';
import { useIntl } from 'react-intl';

import type { IKeyOfIcons } from '@onekeyhq/components';
import { Button, SizableText, XStack } from '@onekeyhq/components';
import { Currency } from '@onekeyhq/kit/src/components/Currency';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { NetworkAvatarBase } from '@onekeyhq/kit/src/components/NetworkAvatar';
import { NETWORK_SHOW_VALUE_THRESHOLD_USD } from '@onekeyhq/shared/src/consts/networkConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { EditableChainSelectorContext } from './context';
import { CELL_HEIGHT } from './type';

import type { IServerNetworkMatch } from '../../types';

type IEditableListItemProps = {
  item: IServerNetworkMatch;
  isDisabled?: boolean;
  isCustomNetworkEditable?: boolean;
  actions?:
    | {
        leadingIcon?: IKeyOfIcons;
        trailingIcon?: IKeyOfIcons;
        title?: string;
        onPress?: () => void;
      }[]
    | React.ReactNode;
};

export const EditableListItem = ({
  item,
  isDisabled,
  isCustomNetworkEditable,
  actions,
}: IEditableListItemProps) => {
  const intl = useIntl();
  const {
    networkId,
    onPressItem,
    onEditCustomNetwork,
    accountNetworkValues,
    accountNetworkValueCurrency,
    accountDeFiOverview,
  } = useContext(EditableChainSelectorContext);

  const onPress = useCallback(() => onPressItem?.(item), [item, onPressItem]);

  const networkTotalValue = useMemo(() => {
    if (item.isAllNetworks) {
      const networkValue = Object.values(accountNetworkValues)
        .reduce((acc, curr) => {
          return acc.plus(curr ?? '0');
        }, new BigNumber(0))
        .toFixed();
      const deFiValue = Object.values(accountDeFiOverview)
        .reduce((acc, curr) => {
          return acc.plus(curr?.netWorth ?? 0);
        }, new BigNumber(0))
        .toFixed();
      return new BigNumber(networkValue).plus(deFiValue).toFixed();
    }

    if (isUndefined(accountNetworkValues[item.id])) {
      return '0';
    }

    return new BigNumber(accountDeFiOverview[item.id]?.netWorth ?? 0)
      .plus(accountNetworkValues[item.id] ?? '0')
      .toFixed();
  }, [item.isAllNetworks, accountNetworkValues, accountDeFiOverview, item.id]);

  return (
    <ListItem
      testID={item.id}
      title={
        item.isAllNetworks
          ? intl.formatMessage({ id: ETranslations.global_all_networks })
          : item.name
      }
      titleMatch={item.titleMatch}
      h={CELL_HEIGHT}
      renderAvatar={
        <NetworkAvatarBase
          logoURI={item.logoURI}
          isCustomNetwork={item.isCustomNetwork}
          isAllNetworks={item.isAllNetworks}
          networkName={item.name}
          size="$8"
          allNetworksIconProps={{
            color: '$iconActive',
          }}
        />
      }
      renderItemText={(textProps) => (
        <ListItem.Text
          userSelect="none"
          {...textProps}
          primary={
            <XStack alignItems="center" gap="$3">
              <SizableText size="$bodyLgMedium">
                {item.isAllNetworks
                  ? intl.formatMessage({
                      id: ETranslations.global_all_networks,
                    })
                  : item.name}
              </SizableText>
              {Array.isArray(actions)
                ? actions?.map((action) => (
                    <Button
                      key={action.title}
                      size="small"
                      variant="secondary"
                      icon={action.leadingIcon}
                      iconAfter={action.trailingIcon}
                      onPress={action.onPress}
                    >
                      {action.title}
                    </Button>
                  ))
                : actions}
            </XStack>
          }
        />
      )}
      onPress={onPress}
      disabled={isDisabled}
      bg={networkId === item.id ? '$bgActive' : undefined}
    >
      <XStack gap="$5">
        {isCustomNetworkEditable && !isDisabled ? (
          <ListItem.IconButton
            icon="PencilOutline"
            title={intl.formatMessage({ id: ETranslations.global_edit })}
            onPress={() => onEditCustomNetwork?.(item)}
          />
        ) : null}

        {new BigNumber(networkTotalValue || 0).gt(
          NETWORK_SHOW_VALUE_THRESHOLD_USD,
        ) ? (
          <Currency
            hideValue
            numberOfLines={1}
            flexShrink={1}
            size="$bodyLgMedium"
            userSelect="none"
            sourceCurrency={accountNetworkValueCurrency}
          >
            {networkTotalValue || '0'}
          </Currency>
        ) : null}
      </XStack>
    </ListItem>
  );
};
