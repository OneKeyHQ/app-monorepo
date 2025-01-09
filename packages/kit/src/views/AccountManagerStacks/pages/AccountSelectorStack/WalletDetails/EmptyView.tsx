import { useIntl } from 'react-intl';

import { Empty, Skeleton, Stack } from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { useToOnBoardingPage } from '@onekeyhq/kit/src/views/Onboarding/pages';
import type { IAccountSelectorAccountsListSectionData } from '@onekeyhq/kit-bg/src/dbs/simple/entity/SimpleDbEntityAccountSelector';
import { useAccountSelectorAccountsListIsLoadingAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';

function LoadingSkeletonView() {
  return (
    <Stack>
      {[1, 2, 3].map((i) => (
        <ListItem key={i}>
          <Stack>
            <Skeleton w="$10" h="$10" />
          </Stack>
          <Stack>
            <Stack py="$1">
              <Skeleton h="$4" w="$32" />
            </Stack>
            <Stack py="$1">
              <Skeleton h="$3" w="$24" />
            </Stack>
          </Stack>
        </ListItem>
      ))}
    </Stack>
  );
}

export function EmptyNoAccountsView({
  section,
}: {
  section: IAccountSelectorAccountsListSectionData;
}) {
  return section.data.length === 0 && section.emptyText ? (
    <ListItem
      // No accounts
      title={section.emptyText}
      titleProps={{
        size: '$bodyLg',
        textAlign: 'left',
        py: '$2',
      }}
    />
  ) : null;
}

export function EmptyNoWalletView() {
  const toOnBoardingPage = useToOnBoardingPage();
  const intl = useIntl();

  return (
    <Empty
      mt="$24"
      icon="WalletOutline"
      title={intl.formatMessage({
        id: ETranslations.global_no_wallet,
      })}
      description={intl.formatMessage({
        id: ETranslations.global_no_wallet_desc,
      })}
      buttonProps={{
        children: intl.formatMessage({
          id: ETranslations.global_create_wallet,
        }),
        onPress: () => {
          void toOnBoardingPage({
            params: {
              showCloseButton: true,
            },
          });
        },
      }}
    />
  );
}

export function EmptyView() {
  const [isLoading] = useAccountSelectorAccountsListIsLoadingAtom();
  return isLoading ? <LoadingSkeletonView /> : <EmptyNoWalletView />;
}
