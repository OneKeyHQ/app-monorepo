import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgDocumentGraph2 = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M9.75 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v4m-2 4a4 4 0 1 0 2.828 6.828M17 13a4 4 0 0 1 2.828 6.828M17 13v4l2.828 2.828M9 7h6m-6 4h2"
    />
  </Svg>
);
export default SvgDocumentGraph2;
