import React from 'react';

import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import { Center, Empty } from '@onekeyhq/components';
import { LocaleIds } from '@onekeyhq/components/src/locale';
import type { IDappSourceInfo } from '@onekeyhq/shared/types';

import useDappApproveAction from '../../../hooks/useDappApproveAction';

import { BaseSendModal } from './BaseSendModal';

export function BaseSendRouteScreen({
  children,
  titleI18nKey,
}: {
  children: JSX.Element;
  titleI18nKey?: LocaleIds;
}) {
  const intl = useIntl();
  const route = useRoute();
  const { networkId, accountId, sourceInfo } = (route.params || {}) as {
    accountId: string;
    networkId: string;
    sourceInfo?: IDappSourceInfo;
  };
  // window.addEventListener('beforeunload') here
  const dappApprove = useDappApproveAction({
    id: sourceInfo?.id ?? '',
    closeOnError: true,
  });
  if (!accountId) {
    // TODO reject dapp request
    return (
      <BaseSendModal
        header={intl.formatMessage({
          id: titleI18nKey || 'empty__no_account_title',
        })}
        accountId={accountId}
        networkId={networkId}
        secondaryActionTranslationId="action__close"
        onSecondaryActionPress={({ close }) => {
          dappApprove.reject();
          close();
        }}
        hidePrimaryAction
        // hideSecondaryAction
        // footer={null}
        onModalClose={() => {
          dappApprove.reject();
        }}
      >
        <Center flex={1} minH="300px">
          <Empty
            emoji="💳"
            title={intl.formatMessage({
              id: 'empty__no_account_title',
            })}
          />
        </Center>
      </BaseSendModal>
    );
  }
  return children;
}
BaseSendRouteScreen.wrap = function (Cmp: any, titleI18nKey?: LocaleIds) {
  const render = () => (
    <BaseSendRouteScreen titleI18nKey={titleI18nKey}>
      <Cmp />
    </BaseSendRouteScreen>
  );
  return render;
};
