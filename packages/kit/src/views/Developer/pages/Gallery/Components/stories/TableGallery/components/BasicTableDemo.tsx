import { Table } from '@onekeyhq/components';

import { userData } from './data';
import type { IUserData } from './types';

// Basic Table Demo
export const BasicTableDemo = () => {
  const columns = [
    {
      title: 'Name',
      dataIndex: 'name',
      columnWidth: 120,
    },
    {
      title: 'Email',
      dataIndex: 'email',
      columnWidth: 180,
    },
    {
      title: 'Age',
      dataIndex: 'age',
      columnWidth: 60,
      align: 'center' as const,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      columnWidth: 80,
      align: 'center' as const,
    },
  ];

  return (
    <Table
      dataSource={userData}
      columns={columns}
      keyExtractor={(item: IUserData) => item.id}
      estimatedItemSize={50}
    />
  );
};