export type InscribeFile = {
  type: string;
  data: string;
  dataLength?: number;
  size: number;
  name: string;
};

export interface Props {
  file?: InscribeFile;
  setFileFromOut: React.Dispatch<
    React.SetStateAction<InscribeFile | undefined>
  >;
}
