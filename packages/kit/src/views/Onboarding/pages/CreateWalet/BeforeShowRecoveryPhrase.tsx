import { Icon, Page, SizableText, Stack } from '@onekeyhq/components';
import type { ColorTokens, IIconProps } from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { EOnboardingPages } from '@onekeyhq/shared/src/routes';

interface IWaningMessage {
  icon?: IIconProps['name'];
  iconColor?: IIconProps['color'];
  iconContainerColor?: ColorTokens;
  message?: string;
}

const messages: IWaningMessage[] = [
  {
    icon: 'LockOutline',
    iconColor: '$iconInfo',
    iconContainerColor: '$bgInfo',
    message:
      'The recovery phrase alone gives you full access to your wallets and funds.',
  },
  {
    icon: 'InputOutline',
    iconColor: '$iconSuccess',
    iconContainerColor: '$bgSuccess',
    message:
      'If you forget your password, you can use the recovery phrase to get back into your wallet.',
  },
  {
    icon: 'EyeOffOutline',
    iconColor: '$iconCritical',
    iconContainerColor: '$bgCritical',
    message: 'Never share it with anyone or enter it into any form.',
  },
  {
    icon: 'ShieldCheckDoneOutline',
    iconColor: '$iconCaution',
    iconContainerColor: '$bgCaution',
    message: 'OneKey Support will never ask for your recovery phrase.',
  },
];

export function BeforeShowRecoveryPhrase() {
  const navigation = useAppNavigation();

  const handleShowRecoveryPhrasePress = () => {
    navigation.push(EOnboardingPages.RecoveryPhrase);
  };

  return (
    <Page safeAreaEnabled>
      <Page.Header title="Before You Proceed" />
      <Page.Body>
        <SizableText pt="$2" pb="$4" px="$6" size="$bodyLgMedium">
          Read the following, then save the phrase securely.
        </SizableText>
        {messages.map((item) => (
          <ListItem key={item.message}>
            <Stack
              p="$2"
              borderRadius="$3"
              bg={item.iconContainerColor}
              style={{
                borderCurve: 'continuous',
              }}
            >
              <Icon name={item.icon} color={item.iconColor} />
            </Stack>
            <ListItem.Text
              flex={1}
              primary={item.message}
              primaryTextProps={{
                size: '$bodyLg',
              }}
            />
          </ListItem>
        ))}
      </Page.Body>
      <Page.Footer
        onConfirmText="Show Recovery Phrase"
        onConfirm={handleShowRecoveryPhrasePress}
      />
    </Page>
  );
}

export default BeforeShowRecoveryPhrase;
