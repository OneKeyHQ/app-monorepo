import React, { useCallback, useMemo } from 'react';

import { ControllerProps, FieldValues } from 'react-hook-form';
import { useIntl } from 'react-intl';

import { Form } from '@onekeyhq/components';
import type { Network } from '@onekeyhq/engine/src/types/network';
import { useManageNetworks } from '@onekeyhq/kit/src/hooks';
import { useAppSelector } from '@onekeyhq/kit/src/hooks/redux';

type FormChainSelectorProps = {
  selectableNetworks?: Array<string>;
};

function FormChainSelector<TFieldValues extends FieldValues = FieldValues>({
  selectableNetworks,
  ...props
}: Omit<ControllerProps<TFieldValues>, 'render'> & FormChainSelectorProps) {
  const intl = useIntl();
  const { enabledNetworks: networks } = useManageNetworks();
  const activeNetwork = useAppSelector((s) => s.general.activeNetwork);
  const currentNetworkId = activeNetwork?.network?.id;
  let defaultNetworkId = currentNetworkId;
  // If selectableNetworks is specified and currenct selected network not in
  // it, set the first selectable network as the default.
  if (
    typeof selectableNetworks !== 'undefined' &&
    (typeof currentNetworkId === 'undefined' ||
      !selectableNetworks.includes(currentNetworkId))
  ) {
    [defaultNetworkId] = selectableNetworks;
  }

  const options = useMemo(() => {
    if (!networks) return [];

    return networks
      .filter(
        (network) =>
          typeof selectableNetworks === 'undefined' ||
          selectableNetworks.includes(network.id),
      )
      .map((network) => ({
        label: network.shortName,
        value: network.id,
        tokenProps: {
          src: network.logoURI,
          letter: network.name,
        },
        badge: network.impl === 'evm' ? 'EVM' : undefined,
      }));
  }, [networks, selectableNetworks]);

  const findActiveNetwork = useCallback<(id: string) => Network | null>(
    (id) => {
      if (!networks) return null;

      let selectedNetwork: Network | null = null;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      networks.forEach((network) => {
        if (network.id === id) {
          selectedNetwork = network;
        }
      });

      return selectedNetwork;
    },
    [networks],
  );

  return (
    <Form.Item
      label={intl.formatMessage({ id: 'network__network' })}
      helpText={(activeNetworkId = defaultNetworkId) => {
        const activeNetworkPayload = findActiveNetwork(activeNetworkId);
        return intl.formatMessage(
          {
            id: 'form__network_helperText',
          },
          {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            impl: activeNetworkPayload?.impl ?? '-',
          },
        );
      }}
      defaultValue={defaultNetworkId as any}
      {...props}
    >
      <Form.Select
        title={intl.formatMessage({ id: 'network__network' })}
        footer={null}
        containerProps={{
          padding: 0,
        }}
        triggerProps={{
          py: 2,
        }}
        options={options}
        dropdownProps={{ width: '352px', maxHeight: '400px' }}
        dropdownPosition="right"
      />
    </Form.Item>
  );
}

export default FormChainSelector;
