import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgSwitchHor = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="m7.5 21-3.293-3.293a1 1 0 0 1 0-1.414L7.5 13m9-2 3.293-3.293a1 1 0 0 0 0-1.414L16.5 3M5 17h15M4 7h15"
    />
  </Svg>
);
export default SvgSwitchHor;
