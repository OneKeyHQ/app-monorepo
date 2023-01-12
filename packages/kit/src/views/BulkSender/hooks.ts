import { useState } from 'react';

import { useDropzone } from 'react-dropzone';
import { read, utils } from 'xlsx';

import type { DropzoneOptions } from 'react-dropzone';

type Props = DropzoneOptions & {
  header?: string[] | number;
};

export function useDropUpload<T>(props: Props) {
  const { header } = props;
  const [data, setData] = useState<T[]>([]);

  const dropZoneState = useDropzone({
    multiple: false,
    accept: {
      'text/csv': ['.csv'],
      'text/plain': ['.txt'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': [
        '.xlsx',
      ],
    },
    onDropAccepted: async (files) => {
      try {
        const file = await files[0].arrayBuffer();
        const wb = read(file, { raw: true });
        const json = utils.sheet_to_json<T>(wb.Sheets[wb.SheetNames[0]], {
          header,
        });
        setData(json);
      } catch {
        // pass
      }
    },
    ...props,
  });

  return {
    ...dropZoneState,
    data,
  };
}
