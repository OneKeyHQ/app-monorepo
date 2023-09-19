import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgDocumentRemove = (props: SvgProps) => (
  <Svg
    viewBox="0 0 20 20"
    fill="currentColor"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M6 2a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7.414A2 2 0 0 0 15.414 6L12 2.586A2 2 0 0 0 10.586 2H6zm1 8a1 1 0 1 0 0 2h6a1 1 0 1 0 0-2H7z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgDocumentRemove;
