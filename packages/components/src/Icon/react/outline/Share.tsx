import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgShare = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M3 8v9a2 2 0 0 0 2 2h14M16.5 4.5 20 8m0 0-3.5 3.5M20 8h-7a5 5 0 0 0-5 5v1"
    />
  </Svg>
);
export default SvgShare;
