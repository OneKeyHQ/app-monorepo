import type { IDownloadAsFileType } from './type';

export const downloadAsFile: IDownloadAsFileType = async ({
  content,
  filename,
}: {
  content: string;
  filename: string;
}) => {
  const element = document.createElement('a');
  const file = new Blob([content], {
    type: 'text/plain',
    endings: 'native',
  });
  element.href = URL.createObjectURL(file);
  element.download = filename;
  document.body.appendChild(element); // Required for this to work in FireFox
  element.click();
};
