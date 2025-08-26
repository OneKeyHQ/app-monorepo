import { memo, useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Alert, SizableText, Stack, YStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { TX_RISKY_LEVEL_SPAM } from '@onekeyhq/shared/src/walletConnect/constant';
import type { IContractApproval } from '@onekeyhq/shared/types/approval';

import { useApprovalListAtom } from '../../states/jotai/contexts/approvalList';
import { ListItem } from '../ListItem';

type IProps = {
  tableLayout?: boolean;
};

function HeaderItem({ label }: { label: string }) {
  return (
    <SizableText size="$bodyMdMedium" color="$textSubdued" userSelect="none">
      {label}
    </SizableText>
  );
}

function ApprovalListHeader({ tableLayout }: IProps) {
  const intl = useIntl();

  const renderTableHeader = useCallback(() => {
    if (!tableLayout) {
      return null;
    }

    return (
      <ListItem testID="Wallet-Approval-List-Header">
        <Stack flexGrow={1} flexBasis={0} alignItems="flex-start">
          <HeaderItem
            label={intl.formatMessage({ id: ETranslations.global_contract })}
          />
        </Stack>
        <Stack flexGrow={1} flexBasis={0}>
          <HeaderItem
            label={intl.formatMessage({
              id: ETranslations.global_contract_address,
            })}
          />
        </Stack>
        <Stack flexGrow={1} flexBasis={0}>
          <HeaderItem
            label={intl.formatMessage({
              id: ETranslations.global_approval_time,
            })}
          />
        </Stack>
        <Stack flexGrow={1} flexBasis={0} alignItems="flex-end" maxWidth="$36">
          <HeaderItem
            label={intl.formatMessage({
              id: ETranslations.wallet_approval_approved_token,
            })}
          />
        </Stack>
      </ListItem>
    );
  }, [intl, tableLayout]);

  const [{ approvals }] = useApprovalListAtom();

  const handleViewRiskApprovals = useCallback(() => {
    console.log('handleViewRiskApprovals');
  }, []);

  const { riskApprovals, warningApprovals } = useMemo(() => {
    return approvals.reduce<{
      riskApprovals: IContractApproval[];
      warningApprovals: IContractApproval[];
    }>(
      (acc, approval) => {
        if (approval.isRiskContract) {
          acc.riskApprovals.push(approval);
        } else if (approval.isInactiveApproval) {
          acc.warningApprovals.push(approval);
        }
        return acc;
      },
      { riskApprovals: [], warningApprovals: [] },
    );
  }, [approvals]);

  const renderRiskOverview = useCallback(() => {
    if (riskApprovals.length === 0 && warningApprovals.length === 0) {
      return null;
    }

    return (
      <YStack px="$5" py="$3" gap="$5">
        {riskApprovals.length > 0 ? (
          <Alert
            title={intl.formatMessage({
              id: ETranslations.wallet_revoke_suggestion,
            })}
            description={intl.formatMessage(
              {
                id: ETranslations.wallet_approval_risky_suggestion_title,
              },
              {
                number: (
                  <SizableText color="$textCritical">
                    {warningApprovals.length}
                  </SizableText>
                ) as unknown as string,
              },
            )}
            type="danger"
            action={{
              primary: intl.formatMessage({
                id: ETranslations.global_view,
              }),
              onPrimaryPress: () => {},
            }}
          />
        ) : null}
        {warningApprovals.length > 0 ? (
          <Alert
            title={intl.formatMessage({
              id: ETranslations.wallet_revoke_suggestion,
            })}
            description={intl.formatMessage(
              {
                id: ETranslations.wallet_approval_inactive_suggestion_title,
              },
              {
                number: (
                  <SizableText size="$bodyMdMedium" color="$textCaution">
                    {warningApprovals.length}
                  </SizableText>
                ) as unknown as string,
              },
            )}
            closable
            type="warning"
          />
        ) : null}
      </YStack>
    );
  }, [intl, riskApprovals, warningApprovals.length]);

  return (
    <>
      {renderTableHeader()}
      {renderRiskOverview()}
    </>
  );
}

export default memo(ApprovalListHeader);
