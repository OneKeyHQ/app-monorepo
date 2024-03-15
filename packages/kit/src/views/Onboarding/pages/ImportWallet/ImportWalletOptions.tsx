import type { IIconProps } from '@onekeyhq/components';
import {
  Button,
  Dialog,
  Icon,
  Page,
  SectionList,
  Stack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { IListItemProps } from '@onekeyhq/kit/src/components/ListItem';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import useLiteCard from '@onekeyhq/kit/src/views/LiteCard/hooks/useLiteCard';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EOnboardingPages } from '@onekeyhq/shared/src/routes';

type IOptionItem = {
  title?: string;
  description?: string;
  icon: IIconProps['name'];
  iconColor?: IIconProps['color'];
  onPress?: IListItemProps['onPress'];
};

type IOptionSection = {
  sectionTitle?: string;
  data: IOptionItem[];
};

export function ImportWalletOptions() {
  const navigation = useAppNavigation();
  const liteCard = useLiteCard();

  const handleConnectHardwareWalletPress = async () => {
    navigation.push(EOnboardingPages.ConnectYourDevice);
  };

  const handleImportRecoveryPhrasePress = async () => {
    await backgroundApiProxy.servicePassword.promptPasswordVerify();
    navigation.push(EOnboardingPages.ImportRecoveryPhrase);
  };

  const handleImportPrivateKeyPress = async () => {
    await backgroundApiProxy.servicePassword.promptPasswordVerify();
    navigation.push(EOnboardingPages.ImportPrivateKey);
  };

  const handleImportAddressPress = async () => {
    navigation.push(EOnboardingPages.ImportAddress);
  };

  const options: IOptionSection[] = [
    {
      sectionTitle: 'Muti-chain Wallet',
      data: [
        {
          title: 'Recovery Phrase',
          icon: 'Document2Outline',
          description:
            'Import a 12-24 word phrase to set up your multi-chain wallet.',
          onPress: () => {
            const dialog = Dialog.show({
              tone: 'warning',
              icon: 'ErrorOutline',
              title: 'Security Alert',
              description:
                "For the safety of your assets, please do not import the recovery phrase of your hardware wallet. Use 'Connect Hardware Wallet' to maintain the highest level of security.",
              renderContent: (
                <Stack>
                  <Button
                    variant="secondary"
                    onPress={async () => {
                      await dialog.close();
                      await handleImportRecoveryPhrasePress();
                    }}
                  >
                    Acknowledged
                  </Button>
                  <Button
                    variant="tertiary"
                    m="0"
                    mt="$2.5"
                    onPress={async () => {
                      await dialog.close();
                      await handleConnectHardwareWalletPress();
                    }}
                  >
                    Connect Hardware Wallet
                  </Button>
                </Stack>
              ),
              showFooter: false,
            });
          },
        },
        ...(platformEnv.isNative
          ? [
              {
                title: 'OneKey Lite',
                icon: 'OnekeyLiteOutline',
                description: 'Import recovery phrase from your OneKey Lite',
                onPress: liteCard.importWallet,
              } as IOptionItem,
            ]
          : []),
        {
          icon: 'OnekeyKeytagOutline',
          title: 'OneKey KeyTag',
          description: 'Import recovery phrase from your OneKey KeyTag',
          onPress: () => console.log('pressed'),
        },
      ],
    },
    {
      sectionTitle: 'Single-chain Account',
      data: [
        {
          title: 'Private Key',
          icon: 'KeyOutline',
          description: 'Import private key to generate a single-chain account.',
          onPress: handleImportPrivateKeyPress,
        },
        {
          title: 'Address',
          icon: 'EyeOutline',
          description: 'Import address to monitor a single-chain account.',
          onPress: handleImportAddressPress,
        },
      ],
    },
    {
      sectionTitle: 'Others',
      data: [
        {
          icon: 'CloudSyncOutline',
          title: 'iCloud',
          description: 'Import your wallet from iCloud',
          onPress: () => console.log('pressed'),
        },
      ],
    },
  ];

  return (
    <Page scrollEnabled>
      <Page.Header title="Import Wallet" />
      <Page.Body>
        {options.map(({ sectionTitle, data }, index) => (
          <Stack
            key={sectionTitle}
            {...(index !== 0 && { mt: '$5' })}
            {...(index === options.length - 1 && { pb: '$5' })}
          >
            <SectionList.SectionHeader title={sectionTitle} />
            {data.map(({ title, icon, description, iconColor, onPress }) => (
              <ListItem key={title} onPress={onPress} drillIn>
                <Stack
                  bg="$bgStrong"
                  p="$2"
                  borderRadius="$2"
                  style={{ borderCurve: 'continuous' }}
                >
                  <Icon
                    name={icon}
                    flexShrink={0}
                    {...(iconColor && {
                      color: iconColor,
                    })}
                  />
                </Stack>
                <ListItem.Text
                  userSelect="none"
                  flex={1}
                  primary={title}
                  secondary={description}
                />
              </ListItem>
            ))}
          </Stack>
        ))}
      </Page.Body>
    </Page>
  );
}

export default ImportWalletOptions;
