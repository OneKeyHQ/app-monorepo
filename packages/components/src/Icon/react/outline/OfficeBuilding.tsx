import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgOfficeBuilding = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M5 20V6a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v14M5 20h14M5 20H3m16 0h2M9 8h1m4 0h1m-6 4h1m4 0h1m-6 4h1m4 0h1"
    />
  </Svg>
);
export default SvgOfficeBuilding;
