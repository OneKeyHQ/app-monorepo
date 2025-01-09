export type IDownloadAsFileType = (params: {
  content: string;
  filename: string;
}) => Promise<void>;
