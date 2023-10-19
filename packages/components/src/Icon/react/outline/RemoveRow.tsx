import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgRemoveRow = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M3 12v5a2 2 0 0 0 2 2h6m-8-7V7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v5H3Zm14 5 2 2m0 0 2 2m-2-2-2 2m2-2 2-2"
    />
  </Svg>
);
export default SvgRemoveRow;
