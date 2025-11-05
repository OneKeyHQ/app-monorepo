import { useState } from 'react';

import { useIntl } from 'react-intl';

import { SizableText, XStack, YStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { HardwareSalesReward } from '../HardwareSalesReward';
import { OnChainReward } from '../OnChainReward';
import { SectionHeader } from '../SectionHeader';

import { InviteCodeListTable } from './components/InviteCodeListTable';

import type { IInvitationDetailsSectionProps } from './types';

interface ITabButtonProps {
  label: string;
  isActive: boolean;
  onPress: () => void;
}

function TabButton({ label, isActive, onPress }: ITabButtonProps) {
  return (
    <XStack
      px="$2"
      py="$1"
      borderRadius="$2"
      backgroundColor={isActive ? '$bgActive' : '$transparent'}
      cursor="pointer"
      onPress={onPress}
      hoverStyle={{
        backgroundColor: isActive ? '$bgActive' : '$bgHover',
      }}
      pressStyle={{
        backgroundColor: '$bgActive',
      }}
    >
      <SizableText size="$bodyMdMedium" color="$text" textAlign="center">
        {label}
      </SizableText>
    </XStack>
  );
}

export function InvitationDetailsSection({
  summaryInfo,
}: IInvitationDetailsSectionProps) {
  const intl = useIntl();
  const [selectedTab, setSelectedTab] = useState<'reward' | 'referral'>(
    'reward',
  );

  if (!summaryInfo) {
    return null;
  }

  const { HardwareSales, Onchain, levelPercent, rebateLevels, rebateConfig } =
    summaryInfo;

  return (
    <YStack gap="$5">
      <SectionHeader
        translationId={ETranslations.referral_invitation_details}
      />

      <XStack gap="$2" px="$5" alignItems="center">
        <TabButton
          label={intl.formatMessage({ id: ETranslations.earn_rewards })}
          isActive={selectedTab === 'reward'}
          onPress={() => setSelectedTab('reward')}
        />
        <TabButton
          label={intl.formatMessage({ id: ETranslations.referral_code_list })}
          isActive={selectedTab === 'referral'}
          onPress={() => setSelectedTab('referral')}
        />
      </XStack>

      {selectedTab === 'reward' ? (
        <XStack py="$8" px="$5" gap="$5">
          <HardwareSalesReward
            hardwareSales={HardwareSales}
            levelPercent={Number(levelPercent)}
            rebateLevels={rebateLevels}
            rebateConfig={rebateConfig}
          />
          <OnChainReward onChain={Onchain} />
        </XStack>
      ) : (
        <YStack px="$5">
          <InviteCodeListTable />
        </YStack>
      )}
    </YStack>
  );
}
