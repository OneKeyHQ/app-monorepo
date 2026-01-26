import { useIntl } from 'react-intl';

import {
  ScrollView,
  SizableText,
  Spinner,
  Stack,
  Table,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  IInviteCodeListItem,
  IInviteCodeListResponse,
} from '@onekeyhq/shared/src/referralCode/type';

import { useSortableData } from './hooks/useSortableData';
import { useTableAvailableWidth } from './hooks/useTableAvailableWidth';
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
  const { containerWidth, onLayout } = useTableAvailableWidth();

  const hasCodeListData = Boolean(codeListData);
  const isInitialLoading = !hasCodeListData && (isLoading ?? true);

  // Sort data
  const { sortedData, handleSortChange } = useSortableData(codeListData?.items);

  // Define columns with container width
  const { columns, handleHeaderRow, shouldUseFlex } = useTableColumns(
    containerWidth,
    handleSortChange,
    refetch,
  );

  // Loading state
  if (isInitialLoading) {
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

  // Table with horizontal scroll support when needed
  return shouldUseFlex ? (
    // Flex layout: table fits in container, no scroll needed
    <Stack flex={1} onLayout={onLayout}>
      <Table<IInviteCodeListItem>
        dataSource={sortedData}
        columns={columns}
        keyExtractor={(item) => item.code}
        onHeaderRow={handleHeaderRow}
        estimatedItemSize={50}
        rowProps={{ px: '$2', minHeight: '$10' }}
      />
    </Stack>
  ) : (
    // Fixed width: table needs horizontal scroll
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator
      bounces={false}
      contentContainerStyle={{
        flexGrow: 1,
      }}
      onLayout={onLayout}
    >
      <Table<IInviteCodeListItem>
        dataSource={sortedData}
        columns={columns}
        keyExtractor={(item) => item.code}
        onHeaderRow={handleHeaderRow}
        estimatedItemSize={50}
        rowProps={{ px: '$2', minHeight: '$10' }}
        scrollEnabled={false}
      />
    </ScrollView>
  );
}
