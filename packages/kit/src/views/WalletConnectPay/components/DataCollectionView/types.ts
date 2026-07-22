export interface IDataCollectionViewProps {
  url: string;
  onComplete: () => void;
  onError: (error: string) => void;
}
