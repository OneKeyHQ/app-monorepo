import { useCallback, useMemo, useState } from 'react';

import { differenceInDays } from 'date-fns';
import { isEmpty } from 'lodash';
import { useIntl } from 'react-intl';

import {
  Divider,
  Icon,
  Popover,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IBorrowReserveItem } from '@onekeyhq/shared/types/staking';

import { ListItem } from '../../../components/ListItem';
import { Token } from '../../../components/Token';
import { EarnActionIcon } from '../../Staking/components/ProtocolDetails/EarnActionIcon';
import { EarnIcon } from '../../Staking/components/ProtocolDetails/EarnIcon';
import { EarnText } from '../../Staking/components/ProtocolDetails/EarnText';

export const BorrowBouns = ({
  data,
  handleHistoryPress,
}: {
  data?: IBorrowReserveItem['overview']['platformBonus'];
  handleHistoryPress: () => void;
}) => {
  const intl = useIntl();
  const [open, setOpen] = useState(false);

  const handleHistoryClick = useCallback(() => {
    setOpen(false);
    handleHistoryPress();
  }, [handleHistoryPress]);

  const itemRender = useCallback(
    ({
      children,
      key,
      needDivider,
    }: {
      children: React.ReactNode;
      key: string | number;
      needDivider?: boolean;
    }) => {
      return (
        <>
          <ListItem
            my="$2"
            key={key}
            ai="center"
            jc="space-between"
            borderWidth="$0"
          >
            {children}
          </ListItem>
          {needDivider ? <Divider mx="$5" my="$2.5" /> : null}
        </>
      );
    },
    [],
  );

  const endsInDays = useMemo(() => {
    if (!data?.data?.endsIn) return '';

    const days = differenceInDays(data.data.endsIn, new Date());

    return String(Math.max(0, days));
  }, [data?.data?.endsIn]);

  if (!data || isEmpty(data?.distributed)) {
    return null;
  }

  return (
    <XStack
      flex={1}
      jc="flex-end"
      mb="auto"
      position="absolute"
      right={0}
      top={0}
    >
      <Popover
        open={open}
        onOpenChange={setOpen}
        placement="bottom-end"
        renderTrigger={
          <XStack cursor="pointer" ai="center">
            <EarnText
              size="$bodySmMedium"
              color="$textSubdued"
              // FIXME i18n
              text={{ text: 'Details' }}
            />
            <Icon
              size="$bodySmMedium"
              name="ChevronDownSmallOutline"
              color="$iconSubdued"
            />
          </XStack>
        }
        title={intl.formatMessage({ id: ETranslations.earn_referral_bonus })}
        renderContent={
          <YStack mt="$2.5" overflow="hidden" borderRadius="$3">
            {isEmpty(data?.distributed) ? null : (
              <SizableText mx="$5" size="$bodyMdMedium" color="$textSubdued">
                {intl.formatMessage({ id: ETranslations.referral_distributed })}
              </SizableText>
            )}
            {data?.distributed.map((item, index) => {
              return itemRender({
                key: index,
                children: (
                  <>
                    <XStack ai="center" gap="$2.5">
                      <Token
                        size="sm"
                        borderRadius="$2"
                        tokenImageUri={item.token.logoURI}
                      />
                      <EarnText
                        size="$bodyMdMedium"
                        color="$text"
                        text={item.title}
                      />
                    </XStack>
                    <EarnText
                      size="$bodyMd"
                      color="$textSubdued"
                      text={item.description}
                    />
                  </>
                ),
              });
            })}
            <Stack mt="$2" px="$5">
              <EarnText
                size="$bodySm"
                color="$textSubdued"
                text={data.description}
              />
              <Divider mt="$5" mb="$3.5" />
              <YStack>
                {/* <EarnIcon icon={data.data.icon} /> */}
                <XStack ai="center">
                  <EarnIcon
                    icon={{
                      icon: 'Ai2StarSolid',
                      color: '$success10',
                      size: '$3.5',
                    }}
                    mr="$1.5"
                  />
                  <EarnText
                    size="$bodySm"
                    color="$textSubdued"
                    text={data.data.title}
                  />
                  <Divider vertical h="$3" mx="$3" />
                  <EarnText
                    size="$bodySmMedium"
                    color="$textSuccess"
                    text={{ text: endsInDays }}
                  />
                </XStack>
                {data.data.button ? (
                  <EarnActionIcon actionIcon={data.data.button} />
                ) : null}
              </YStack>
            </Stack>
          </YStack>
        }
      />
    </XStack>
  );
};
