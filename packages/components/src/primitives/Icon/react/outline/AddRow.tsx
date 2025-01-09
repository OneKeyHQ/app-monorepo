import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgAddRow = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M3 12v5a2 2 0 0 0 2 2h6m-8-7V7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v5H3Zm16 4v3m0 0v3m0-3h-3m3 0h3"
    />
  </Svg>
);
export default SvgAddRow;
