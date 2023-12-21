import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgSwitchVer = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="m3 7.5 3.293-3.293a1 1 0 0 1 1.414 0L11 7.5m2 9 3.293 3.293a1 1 0 0 0 1.414 0L21 16.5M7 5v15M17 4v15"
    />
  </Svg>
);
export default SvgSwitchVer;
