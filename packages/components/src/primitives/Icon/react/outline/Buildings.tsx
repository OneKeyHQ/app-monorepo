import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgBuildings = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M4 19h10M4 19V6a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v2M4 19H2m12 0V8m0 11h6M14 8h4a2 2 0 0 1 2 2v9m0 0h2M10 9H8m0 4h2"
    />
  </Svg>
);
export default SvgBuildings;
