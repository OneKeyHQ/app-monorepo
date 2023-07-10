export type InscribeFile = {
  type: string;
  dataLength?: number;
  size?: number;
  name?: string | null;
  dataForUI?: string;
  dataForAPI?: string;
};

export interface Props {
  file?: InscribeFile;
  setFileFromOut: React.Dispatch<
    React.SetStateAction<InscribeFile | undefined>
  >;
  error?: string;
  setError: React.Dispatch<React.SetStateAction<string>>;
}
