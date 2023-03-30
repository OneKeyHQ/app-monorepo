import type { FC } from 'react';
import { memo, useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  Box,
  Icon,
  Select,
  Text,
  Token,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import type { SelectItem } from '@onekeyhq/components/src/Select';
import type { Wallet } from '@onekeyhq/engine/src/types/wallet';
import { useManageNetworks } from '@onekeyhq/kit/src/hooks';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import {
  ManageNetworkModalRoutes,
  ModalRoutes,
  RootRoutes,
} from '@onekeyhq/kit/src/routes/routesEnum';

type Props = {
  selectedNetworkId: string | undefined;
  setSelectedNetworkId: (id: string) => void;
  activeWallet: null | Wallet | undefined;
};

export const AllNetwork = 'all';

const RightChainSelector: FC<Props> = ({
  selectedNetworkId,
  setSelectedNetworkId,
  activeWallet,
}) => {
  const intl = useIntl();
  // eslint-disable-next-line no-param-reassign
  selectedNetworkId = selectedNetworkId || AllNetwork;
  const navigation = useAppNavigation();
  const isVerticalLayout = useIsVerticalLayout();
  const { enabledNetworks } = useManageNetworks();

  const options = useMemo(() => {
    const availableNetworks = !activeWallet
      ? enabledNetworks
      : // eslint-disable-next-line @typescript-eslint/no-unused-vars
        enabledNetworks.filter(({ settings }) => {
          switch (activeWallet.type) {
            case 'hw':
              return true;
            // return settings.hardwareAccountEnabled;
            case 'imported':
              return true;
            // return settings.importedAccountEnabled;
            case 'watching':
              return true;
            // return settings.watchingAccountEnabled;
            case 'external':
              return true;
            // return settings.externalAccountEnabled;
            default:
              return true; // HD accounts are always supported.
          }
        });
    const selectNetworkExists = availableNetworks.find(
      (network) => network.id === selectedNetworkId,
    );
    if (!selectNetworkExists) {
      // setTimeout(() => setSelectedNetworkId(AllNetwork));
    }

    if (!availableNetworks) return [];

    const networks: SelectItem<string>[] = availableNetworks.map((network) => ({
      label: network.shortName,
      value: network.id,
      tokenProps: {
        token: {
          logoURI: network?.logoURI,
          name: network?.shortName,
        },
      },
      badge: network.impl === 'evm' ? 'EVM' : undefined,
    }));
    networks.unshift({
      label: intl.formatMessage({ id: 'option__all' }),
      value: AllNetwork,
      iconProps: {
        name: 'OptionListAllMini',
        size: isVerticalLayout ? 32 : 24,
        color: 'surface-neutral-default',
      },
    });

    return networks;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabledNetworks, isVerticalLayout, intl, activeWallet]);

  return (
    <Select
      setPositionOnlyMounted
      positionTranslateY={4}
      dropdownPosition="right"
      value={selectedNetworkId}
      onChange={(v) => setSelectedNetworkId(v === AllNetwork ? '' : v)}
      title={intl.formatMessage({ id: 'network__networks' })}
      options={options}
      isTriggerPlain
      footerText={intl.formatMessage({ id: 'action__customize_network' })}
      footerIcon="PencilMini"
      onPressFooter={() => {
        setTimeout(() => {
          navigation.navigate(RootRoutes.Modal, {
            screen: ModalRoutes.ManageNetwork,
            params: {
              screen: ManageNetworkModalRoutes.Listing,
              // params: { onEdited: refreshAccounts },
            },
          });
        }, 500);
      }}
      renderTrigger={({ activeOption, isHovered, visible }) => (
        <Box
          display="flex"
          flexDirection="row"
          alignItems="center"
          py={2}
          pl="3"
          pr="2.5"
          borderWidth="1"
          borderColor={
            // eslint-disable-next-line no-nested-ternary
            visible
              ? 'focused-default'
              : isHovered
              ? 'border-hovered'
              : 'border-default'
          }
          borderRadius="xl"
          bg={
            // eslint-disable-next-line no-nested-ternary
            visible
              ? 'surface-selected'
              : // eslint-disable-next-line no-nested-ternary
              isHovered
              ? 'surface-hovered'
              : 'surface-default'
          }
        >
          <Box
            display="flex"
            flex={1}
            flexDirection="row"
            alignItems="center"
            mr="1"
          >
            {!!activeOption.tokenProps && (
              <Box mr="3">
                <Token
                  size={activeOption.description ? 8 : 6}
                  {...activeOption.tokenProps}
                />
              </Box>
            )}
            {!!activeOption.iconProps && (
              <Box mr="3">
                <Icon {...activeOption.iconProps} size={24} />
              </Box>
            )}
            <Box flex={1}>
              <Text
                typography={{ sm: 'Body1', md: 'Body2' }}
                numberOfLines={1}
                flex={1}
                isTruncated
              >
                {activeOption.label ?? '-'}
              </Text>
            </Box>
          </Box>
          <Icon size={20} name="ChevronDownMini" />
        </Box>
      )}
    />
  );
};

export default memo(RightChainSelector);
