import { Fragment } from 'react';

import { Divider, XStack, YStack } from '@onekeyhq/components';
import { EarnActionIcon } from '@onekeyhq/kit/src/views/Staking/components/ProtocolDetails/EarnActionIcon';
import { EarnIcon } from '@onekeyhq/kit/src/views/Staking/components/ProtocolDetails/EarnIcon';
import { EarnText } from '@onekeyhq/kit/src/views/Staking/components/ProtocolDetails/EarnText';
import type { IBorrowReserveDetail } from '@onekeyhq/shared/types/staking';

export function RiskSection({ risk }: { risk?: IBorrowReserveDetail['risk'] }) {
  if (!risk?.items?.length) {
    return null;
  }

  return (
    <>
      <YStack gap="$6">
        <YStack gap="$3">
          {risk.items.map((item, index) => (
            <Fragment key={`${item.title.text}-${index}`}>
              <XStack ai="center" gap="$3">
                <YStack flex={1} gap="$2">
                  <XStack ai="center" gap="$2">
                    <XStack
                      ai="center"
                      jc="center"
                      w="$6"
                      h="$6"
                      borderRadius="$1"
                    >
                      <EarnIcon
                        icon={item.icon}
                        size="$6"
                        color="$iconCaution"
                      />
                    </XStack>
                    <EarnText text={item.title} size="$bodyMdMedium" />
                  </XStack>
                  <EarnText
                    text={item.description}
                    size="$bodyMd"
                    color={item.description.color || '$textSubdued'}
                  />
                </YStack>
                <EarnActionIcon
                  title={item.title.text}
                  actionIcon={item.actionButton}
                />
              </XStack>
            </Fragment>
          ))}
        </YStack>
      </YStack>
      <Divider />
    </>
  );
}
