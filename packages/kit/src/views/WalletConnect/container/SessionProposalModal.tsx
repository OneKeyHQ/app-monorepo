import { IPageNavigationProp, Page, Stack, Text } from '@onekeyhq/components';

function SessionProposalModal() {
  return (
    <Page>
      <Page.Header title="Session Proposal" />
      <Page.Body>
        <Stack space="$3">
          <Text>Session Proposal</Text>
        </Stack>
      </Page.Body>
      <Page.Footer
        onConfirmText="Approval"
        onCancelText="Reject"
        onConfirm={() => alert('confirmed')}
        onCancel={() => alert('cancel')}
      />
    </Page>
  );
}

export default SessionProposalModal;
