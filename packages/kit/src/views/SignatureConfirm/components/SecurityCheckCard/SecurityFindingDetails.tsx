import { Dialog, SizableText, YStack } from '@onekeyhq/components';

import { DAppRiskyAlertDetail } from '../../../DAppConnection/components/DAppRequestLayout/DAppRiskyAlertDetail';
import { SignatureConfirmTestIDs } from '../../testIDs';

import { TransactionSecurityFeatureList } from './TransactionSecurityDetails';

import type { ISecurityCheckFinding } from './securityCheckModel';

function SecurityFindingDetails({
  finding,
  description,
}: {
  finding: ISecurityCheckFinding;
  description?: string;
}) {
  if (finding.action?.type === 'transactionSecurity') {
    return (
      <YStack testID={SignatureConfirmTestIDs.SecurityFindingDetails}>
        <TransactionSecurityFeatureList result={finding.action.result} />
      </YStack>
    );
  }

  return (
    <YStack testID={SignatureConfirmTestIDs.SecurityFindingDetails} gap="$4">
      {description ? (
        <SizableText size="$bodyMd">{description}</SizableText>
      ) : null}
      {finding.action?.type === 'site' ? (
        <DAppRiskyAlertDetail
          urlSecurityInfo={finding.action.urlSecurityInfo}
        />
      ) : null}
    </YStack>
  );
}

export function showSecurityFindingDetails({
  finding,
  description,
}: {
  finding: ISecurityCheckFinding;
  description?: string;
}) {
  Dialog.show({
    title: finding.title,
    showFooter: false,
    renderContent: (
      <SecurityFindingDetails finding={finding} description={description} />
    ),
  });
}
