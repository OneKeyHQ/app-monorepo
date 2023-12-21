import { Dialog, Text, XStack } from '@onekeyhq/components';

import { WalletOptionItem } from './WalletOptionItem';

function DescriptionList({
  label,
  description,
}: {
  label: string;
  description: string;
}) {
  return (
    <XStack justifyContent="space-between" alignItems="center" minHeight="$9">
      <Text textAlign="right" color="$textSubdued" variant="$bodyMd">
        {label}
      </Text>
      <Text variant="$bodyMdMedium">{description}</Text>
    </XStack>
  );
}

const ListData = [
  {
    label: 'Serial Number',
    description: 'Bixin21042001987',
  },
  {
    label: 'Bluetooth Name',
    description: 'K8101',
  },
  {
    label: 'Firmware Version',
    description: '3.4.0',
  },
  {
    label: 'Bluetooth Firmware Version',
    description: '1.4.1',
  },
];

export function AboutDevice() {
  return (
    <WalletOptionItem
      icon="InfoCircleOutline"
      label="About"
      onPress={() =>
        Dialog.show({
          title: 'About',
          showFooter: false,
          renderContent: (
            <>
              {ListData.map((item) => (
                <DescriptionList
                  key={item.label}
                  label={item.label}
                  description={item.description}
                />
              ))}
            </>
          ),
        })
      }
    />
  );
}
