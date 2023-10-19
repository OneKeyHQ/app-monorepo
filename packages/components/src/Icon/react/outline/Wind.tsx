import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgWind = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M3 12h16a2 2 0 1 0-1.414-3.414M3 8h8a2 2 0 1 0-1.414-3.414M3 16h12a2 2 0 1 1-1.414 3.414"
    />
  </Svg>
);
export default SvgWind;
