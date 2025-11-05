import { useIntl } from 'react-intl';

import { SizableText, Spinner, Stack, Table } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  IInviteCodeListItem,
  IInviteCodeListResponse,
} from '@onekeyhq/shared/src/referralCode/type';

import { useSortableData } from './hooks/useSortableData';
import { useTableColumns } from './hooks/useTableColumns';

interface IInviteCodeListTableProps {
  codeListData: IInviteCodeListResponse | undefined;
  isLoading: boolean;
  refetch: () => void;
}

export function InviteCodeListTable({
  codeListData,
  isLoading,
  refetch,
}: IInviteCodeListTableProps) {
  const intl = useIntl();

  // Sort data
  const { sortedData, handleSortChange } = useSortableData(codeListData?.items);

  // Define columns
  const { columns, handleHeaderRow } = useTableColumns(
    handleSortChange,
    refetch,
  );

  // Loading state
  if (isLoading || !codeListData) {
    return (
      <Stack alignItems="center" justifyContent="center" py="$10">
        <Spinner size="large" />
      </Stack>
    );
  }

  // Empty state
  if (sortedData.length === 0) {
    return (
      <Stack alignItems="center" justifyContent="center" py="$10">
        <SizableText size="$bodyMd" color="$textSubdued">
          {intl.formatMessage({ id: ETranslations.global_no_data })}
        </SizableText>
      </Stack>
    );
  }

  // Table with horizontal scroll support
  return (
    <Stack
      flex={1}
      style={{
        overflowX: 'auto',
      }}
    >
      <Stack flex={1} minHeight={400}>
        <Table<IInviteCodeListItem>
          dataSource={sortedData}
          columns={columns}
          keyExtractor={(item) => item.code}
          onHeaderRow={handleHeaderRow}
          estimatedItemSize={50}
        />
      </Stack>
    </Stack>
  );
}
