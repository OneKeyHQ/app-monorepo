export type InscribeFile = {
  type: string;
  data: string;
  size: number;
  name: string;
};

export interface Props {
  file?: InscribeFile;
  setFileFromOut: React.Dispatch<
    React.SetStateAction<InscribeFile | undefined>
  >;
}
