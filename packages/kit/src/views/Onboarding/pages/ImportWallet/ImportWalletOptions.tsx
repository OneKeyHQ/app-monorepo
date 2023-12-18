import { StyleSheet } from 'react-native';

import type { IIconProps, IListItemProps } from '@onekeyhq/components';
import {
  Button,
  Dialog,
  Divider,
  Group,
  Heading,
  Icon,
  ListItem,
  Page,
  Stack,
} from '@onekeyhq/components';

import useAppNavigation from '../../../../hooks/useAppNavigation';
import { EOnboardingPages } from '../../router/type';

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

  const handleConnectHardwareWalletPress = () => {
    navigation.push(EOnboardingPages.ConnectYourDevice);
  };

  const handleImportRecoveryPhrasePress = () => {
    navigation.push(EOnboardingPages.ImportRecoveryPhrase);
  };

  const handleImportPrivateKeyPress = () => {
    navigation.push(EOnboardingPages.ImportPrivateKey);
  };

  const handleImportAddressPress = () => {
    navigation.push(EOnboardingPages.ImportAddress);
  };

  const options: IOptionSection[] = [
    {
      sectionTitle: 'Wallet',
      data: [
        {
          title: 'Import Recovery Phrase',
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
                      handleImportRecoveryPhrasePress();
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
                      handleConnectHardwareWalletPress();
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
      ],
    },
    {
      sectionTitle: 'Account',
      data: [
        {
          title: 'Import Private Key',
          icon: 'KeyOutline',
          description: 'Import private key to generate a single-chain account.',
          onPress: handleImportPrivateKeyPress,
        },
        {
          title: 'Import Address',
          icon: 'SearchOutline',
          description: 'Import address to monitor a single-chain account.',
          onPress: handleImportAddressPress,
        },
      ],
    },
  ];

  return (
    <Page scrollEnabled>
      <Page.Header title="Import Wallet" />
      <Page.Body px="$5">
        {options.map(({ sectionTitle, data }, index) => (
          <Stack
            key={sectionTitle}
            {...(index !== 0 && { mt: '$2.5' })}
            {...(index === options.length - 1 && { pb: '$5' })}
          >
            <Heading size="$headingSm" color="$textSubdued" py="$2.5">
              {sectionTitle}
            </Heading>
            <Group
              bg="$bgSubdued"
              borderWidth={StyleSheet.hairlineWidth}
              borderRadius="$3"
              borderColor="$borderSubdued"
              separator={<Divider />}
            >
              {data.map(({ title, icon, description, iconColor, onPress }) => (
                <ListItem key={title} m="0" p="$4" onPress={onPress} drillIn>
                  <Stack
                    flex={1}
                    space="$3"
                    $group-card-hover={{
                      p: '$4',
                    }}
                  >
                    <Stack
                      alignSelf="flex-start"
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
                      primaryTextProps={{
                        size: '$headingMd',
                      }}
                      secondary={description}
                      secondaryTextProps={{
                        mt: '$1',
                      }}
                    />
                  </Stack>
                </ListItem>
              ))}
            </Group>
          </Stack>
        ))}
      </Page.Body>
    </Page>
  );
}
