import { useIntl } from 'react-intl';

import type { IXStackProps } from '@onekeyhq/components';
import { Button, SizableText, YStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { HomeTestIDs } from '../../testIDs';
import { HomeTokenListProviderMirrorWrapper } from '../HomeTokenListProvider';

import { RawActions } from './RawActions';
import { WalletActionMore } from './WalletActionMore';
import { WalletActionReceive } from './WalletActionReceive';

export function ZeroBalanceWalletActions({ ...rest }: IXStackProps) {
  const intl = useIntl();
  const rawActionsLayout = {
    justifyContent: 'flex-start',
    gap: '$2.5',
    $gtSm: {
      flexDirection: 'row',
      justifyContent: 'flex-start',
      gap: '$2.5',
    },
  } as const;

  return (
    <YStack {...rest} gap="$3">
      <SizableText size="$bodyMd" color="$textSubdued">
        {intl.formatMessage({ id: ETranslations.add_money_to_get_started })}
      </SizableText>
      <RawActions {...rawActionsLayout}>
        <WalletActionReceive
          key="receive"
          useSelector
          variant="home_add_money"
          renderTrigger={({ onPress, disabled }) => (
            <Button
              flex={1}
              size="large"
              variant="primary"
              icon="PlusLargeOutline"
              onPress={onPress}
              disabled={disabled}
              testID={HomeTestIDs.addMoneyButton}
              $gtSm={{ flex: 0, alignSelf: 'flex-start', minWidth: 200 }}
            >
              {intl.formatMessage({ id: ETranslations.global_add_money })}
            </Button>
          )}
        />
        <WalletActionMore iconOnly />
      </RawActions>
    </YStack>
  );
}

export function NativeHomeZeroBalanceWalletActions({
  accountId,
  ...rest
}: IXStackProps & { accountId: string }) {
  return (
    <HomeTokenListProviderMirrorWrapper accountId={accountId}>
      <ZeroBalanceWalletActions {...rest} />
    </HomeTokenListProviderMirrorWrapper>
  );
}
