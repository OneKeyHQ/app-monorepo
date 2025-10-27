import { useCallback, useState } from 'react';

import { SizableText, Table } from '@onekeyhq/components';
import type { ITableColumn } from '@onekeyhq/components';

import { featureData } from './data';

import type { IFeatureData } from './types';

// Simple Table with Sorting Demo
export const InteractiveTableDemo = () => {
  const [sortedData, setSortedData] = useState(featureData);

  const handleSortChange = useCallback(
    (sortBy: string, sortType: 'asc' | 'desc' | undefined) => {
      if (sortType === undefined) {
        setSortedData(featureData);
        return;
      }

      const sorted = [...featureData].sort((a, b) => {
        const aValue = a[sortBy as keyof IFeatureData];
        const bValue = b[sortBy as keyof IFeatureData];

        if (aValue < bValue) {
          return sortType === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortType === 'asc' ? 1 : -1;
        }
        return 0;
      });

      setSortedData(sorted);
    },
    [],
  );

  const columns = [
    {
      title: 'Feature',
      dataIndex: 'feature',
      columnWidth: 130,
      render: (text: string) => (
        <SizableText size="$bodyMd" color="$text">
          {text}
        </SizableText>
      ),
    },
    {
      title: 'Supported',
      dataIndex: 'supported',
      columnWidth: 130,
      align: 'center' as const,
      render: (text: string) => (
        <SizableText size="$bodyMd" color="$text">
          {text}
        </SizableText>
      ),
    },
    {
      title: 'ID',
      dataIndex: 'id',
      columnWidth: 100,
      align: 'center' as const,
      render: (text: string) => (
        <SizableText size="$bodyMd" color="$textSubdued">
          #{text}
        </SizableText>
      ),
    },
  ];

  const handleHeaderPress = useCallback(
    (column: ITableColumn<IFeatureData>) => {
      return {
        onSortTypeChange: (order: 'asc' | 'desc' | undefined) => {
          handleSortChange(column.dataIndex, order);
        },
      };
    },
    [handleSortChange],
  );

  return (
    <Table<IFeatureData>
      dataSource={sortedData}
      columns={columns}
      keyExtractor={(item) => item.id}
      onHeaderRow={handleHeaderPress}
      estimatedItemSize={50}
    />
  );
};
