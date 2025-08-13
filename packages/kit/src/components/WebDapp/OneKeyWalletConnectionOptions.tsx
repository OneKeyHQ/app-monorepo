import { useIntl } from 'react-intl';

import { Icon, SizableText } from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { ETranslations } from '@onekeyhq/shared/src/locale';

interface IOneKeyWalletConnectionOptionsProps {
  onExtensionPress?: () => void;
  onHardwarePress?: () => void;
}

function OneKeyWalletConnectionOptions({
  onExtensionPress,
  onHardwarePress,
}: IOneKeyWalletConnectionOptionsProps) {
  const intl = useIntl();

  const handleExtensionPress = () => {
    console.log('OneKey wallet extension');
    onExtensionPress?.();
  };

  const handleHardwarePress = () => {
    console.log('OneKey hardware wallet');
    onHardwarePress?.();
  };

  return (
    <>
      <ListItem
        py="$4"
        px="$5"
        mx="$0"
        bg="$bgSubdued"
        title="OneKey wallet extension"
        subtitle="EVM"
        renderAvatar={<Icon name="OnekeyBrand" size="$10" />}
        drillIn
        onPress={handleExtensionPress}
      />
      <ListItem
        py="$4"
        px="$5"
        mx="$0"
        bg="$bgSubdued"
        title="OneKey hardware wallet"
        subtitle={
          <>
            <SizableText size="$bodyMd" color="$textSubdued">
              {intl.formatMessage({
                id: ETranslations.wallet_hardware_wallet_connect_description_1,
              })}
            </SizableText>
            <SizableText size="$bodyMd" color="$textSubdued">
              {intl.formatMessage({
                id: ETranslations.wallet_hardware_wallet_connect_description_2,
              })}
            </SizableText>
          </>
        }
        renderAvatar={<Icon name="OnekeyBrand" size="$10" />}
        drillIn
        onPress={handleHardwarePress}
      />
    </>
  );
}

export { OneKeyWalletConnectionOptions };
