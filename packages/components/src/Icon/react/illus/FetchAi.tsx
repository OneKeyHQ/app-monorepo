import Svg, { SvgProps, Rect, Path } from 'react-native-svg';
const SvgFetchai = (props: SvgProps) => (
  <Svg viewBox="0 0 16 16" fill="none" accessibilityRole="image" {...props}>
    <Rect x={0.5} y={0.5} width={15} height={15} rx={7.5} fill="#303040" />
    <Path
      d="M6.446 3.998h.953v.995h-.953v-.995Zm-2.405 0h.995v.995h-.995v-.995Zm.954 2.404v.995H4v-.995h.995Zm-.249 5.472h-.414V11.5h.373v.373h.041Zm.29-1.99h-.995v-.953h.995v.953Zm2.114 1.99h-.373V11.5h.373v.373Zm0-2.322h-.373V9.18h.373v.373Zm.29-2.114h-.994v-.994h.994v.994Zm2.114 4.436h-.373V11.5h.373v.373Zm0-2.322h-.373V9.18h.373v.373Zm0-2.445h-.373v-.373h.373v.373Zm.332-2.114h-.995v-.995h.995v.995ZM12 11.873h-.373v-.372H12v.373Zm0-2.32h-.373v-.374H12v.373Zm0-2.446h-.373v-.373H12v.373Zm0-2.404h-.373V4.33H12v.373Z"
      fill="#E2E2E8"
    />
    <Rect x={0.5} y={0.5} width={15} height={15} rx={7.5} stroke="#1E1E2A" />
  </Svg>
);
export default SvgFetchai;
