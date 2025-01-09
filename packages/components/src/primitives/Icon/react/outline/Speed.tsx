import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgSpeed = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="m11.999 13-3-3M5.29 19a9 9 0 1 1 13.418 0"
    />
  </Svg>
);
export default SvgSpeed;
