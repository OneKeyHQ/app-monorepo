import { Dialog, SizableText, YStack } from '@onekeyhq/components';

import { DAppRiskyAlertDetail } from '../../../DAppConnection/components/DAppRequestLayout/DAppRiskyAlertDetail';
import { SignatureConfirmTestIDs } from '../../testIDs';

import { TransactionSecurityFeatureList } from './TransactionSecurityDetails';

import type { ISecurityCheckFinding } from './securityCheckModel';

function SecurityFindingDetails({
  finding,
}: {
  finding: ISecurityCheckFinding;
}) {
  return (
    <YStack testID={SignatureConfirmTestIDs.SecurityFindingDetails} gap="$4">
      {finding.description ? (
        <SizableText size="$bodyMd">{finding.description}</SizableText>
      ) : null}
      {finding.action?.type === 'transactionSecurity' ? (
        <TransactionSecurityFeatureList result={finding.action.result} />
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
}: {
  finding: ISecurityCheckFinding;
}) {
  Dialog.show({
    title: finding.title,
    showFooter: false,
    renderContent: <SecurityFindingDetails finding={finding} />,
  });
}
