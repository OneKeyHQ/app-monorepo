import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import type { IKeyOfIcons } from '@onekeyhq/components';
import {
  Accordion,
  Button,
  Icon,
  Page,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { AccountSelectorProviderMirror } from '../../../components/AccountSelector';
import { ListItem } from '../../../components/ListItem';
import { useHelpLink } from '../../../hooks/useHelpLink';
import { HomeTokenListProviderMirror } from '../../Home/components/HomeTokenListProvider/HomeTokenListProviderMirror';
import { WalletActionBuy } from '../../Home/components/WalletActions/WalletActionBuy';
import { WalletActionReceive } from '../../Home/components/WalletActions/WalletActionReceive';

import type { IListItemProps } from '../../../components/ListItem';

function ReceiveOptions({
  icon,
  title,
  subtitle,
  ...props
}: { icon: IKeyOfIcons; title: string; subtitle: string } & IListItemProps) {
  return (
    <ListItem
      mx="$0"
      p="$5"
      borderWidth={1}
      borderColor="$borderSubdued"
      drillIn
      gap="$4"
      userSelect="none"
      bg="$bg"
      {...props}
    >
      <YStack bg="$neutral3" p="$2" borderRadius="$full">
        <Icon name={icon} />
      </YStack>
      <ListItem.Text flex={1} primary={title} secondary={subtitle} />
    </ListItem>
  );
}

function ReceiveSelectorContent() {
  const intl = useIntl();
  // eslint-disable-next-line spellcheck/spell-checker
  const binanceHelpLink = useHelpLink({
    path: 'articles/12553421',
  });
  const okxHelpLink = useHelpLink({
    path: 'articles/12553973',
  });
  const coinbaseHelpLink = useHelpLink({
    path: 'articles/12561338',
  });
  return (
    <Page>
      <Page.Header
        title={intl.formatMessage({ id: ETranslations.global_receive })}
      />
      <Page.Body>
        <YStack gap="$2.5" px="$5">
          <WalletActionBuy
            sameModal
            onClose={() => {}}
            source="receiveSelector"
            renderTrigger={({ onPress, disabled }) => (
              <ReceiveOptions
                icon="CreditCardOutline"
                title="Buy crypto"
                subtitle="Credit/Debit card, Apple Pay, Google Pay, etc."
                onPress={onPress}
                disabled={disabled}
              />
            )}
          />
          <WalletActionReceive
            sameModal
            source="receiveSelector"
            renderTrigger={({ onPress, disabled }) => (
              <ReceiveOptions
                icon="QrCodeOutline"
                title="Receive from another wallet"
                subtitle="Receive using your wallet address"
                onPress={onPress}
                disabled={disabled}
              />
            )}
          />
          <YStack
            bg="$neutral2"
            borderRadius="$3"
            borderColor="$borderSubdued"
            borderCurve="continuous"
          >
            <Accordion type="single" collapsible>
              <Accordion.Item value="exchange">
                <Accordion.Trigger
                  unstyled
                  borderWidth={1}
                  borderColor="$borderSubdued"
                  borderRadius="$3"
                  borderCurve="continuous"
                  p="$5"
                  bg="$bg"
                  gap="$4"
                  alignItems="center"
                  flexDirection="row"
                  hoverStyle={{
                    bg: '$neutral2',
                  }}
                >
                  {({ open }: { open: boolean }) => (
                    <>
                      <YStack bg="$neutral3" p="$2" borderRadius="$full">
                        <Icon name="SwitchHorOutline" />
                      </YStack>
                      <ListItem.Text
                        flex={1}
                        primary="Receive from exchange"
                        secondary="Binance, OKX, Coinbase, etc."
                      />
                      <YStack
                        animation="quick"
                        rotate={open ? '90deg' : '0deg'}
                      >
                        <ListItem.DrillIn />
                      </YStack>
                    </>
                  )}
                </Accordion.Trigger>
                <Accordion.HeightAnimator animation="quick">
                  <Accordion.Content unstyled p="$5">
                    <SizableText mb="$2" color="$textSubdued">
                      Learn how to withdraw crypto assets from:
                    </SizableText>
                    <XStack gap="$6">
                      <Button
                        size="small"
                        variant="tertiary"
                        childrenAsText={false}
                        onPress={() => {
                          // eslint-disable-next-line spellcheck/spell-checker
                          openUrlExternal(binanceHelpLink);
                        }}
                      >
                        <XStack alignItems="center" gap="$2">
                          <YStack p={3} borderRadius="$1" bg="$yellow6">
                            <Icon
                              size="$3"
                              name="BinanceBrand"
                              color="$yellow11"
                            />
                          </YStack>
                          <SizableText>Binance ↗</SizableText>
                        </XStack>
                      </Button>
                      <Button
                        size="small"
                        variant="tertiary"
                        childrenAsText={false}
                        onPress={() => {
                          openUrlExternal(okxHelpLink);
                        }}
                      >
                        <XStack alignItems="center" gap="$2">
                          <YStack p={3} borderRadius="$1" bg="$neutral6">
                            <Icon
                              size="$3"
                              name="OkxBrand"
                              color="$neutral11"
                            />
                          </YStack>
                          <SizableText>OKX ↗</SizableText>
                        </XStack>
                      </Button>
                      <Button
                        size="small"
                        variant="tertiary"
                        childrenAsText={false}
                        onPress={() => {
                          openUrlExternal(coinbaseHelpLink);
                        }}
                      >
                        <XStack alignItems="center" gap="$2">
                          <YStack p={3} borderRadius="$1" bg="$blue6">
                            <Icon
                              size="$3"
                              name="CoinbaseBrand"
                              color="$blue11"
                            />
                          </YStack>
                          <SizableText>Coinbase ↗</SizableText>
                        </XStack>
                      </Button>
                    </XStack>
                  </Accordion.Content>
                </Accordion.HeightAnimator>
              </Accordion.Item>
            </Accordion>
          </YStack>
        </YStack>
      </Page.Body>
    </Page>
  );
}

function ReceiveSelector() {
  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.home,
        sceneUrl: '',
      }}
      enabledNum={[0]}
    >
      <HomeTokenListProviderMirror>
        <ReceiveSelectorContent />
      </HomeTokenListProviderMirror>
    </AccountSelectorProviderMirror>
  );
}

export default ReceiveSelector;
