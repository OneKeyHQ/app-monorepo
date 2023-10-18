import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgDocumentAdd1 = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M11 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v6m-1 4v3m0 0v3m0-3h-3m3 0h3"
    />
  </Svg>
);
export default SvgDocumentAdd1;
