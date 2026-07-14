import { Page, Spinner, Stack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';

function BulkExportHistoryTaskList() {
  const { result: tasks, isLoading } = usePromiseResult(
    async () =>
      backgroundApiProxy.serviceHistory.fetchExportTransactionHistoryTasks(),
    [],
    { watchLoading: true },
  );

  // TODO render the export task list once the UI design is ready
  void tasks;

  return (
    <Page>
      <Page.Header title="Export history" />
      <Page.Body>
        {isLoading ? (
          <Stack flex={1} alignItems="center" justifyContent="center">
            <Spinner size="large" />
          </Stack>
        ) : null}
      </Page.Body>
    </Page>
  );
}

export default BulkExportHistoryTaskList;
