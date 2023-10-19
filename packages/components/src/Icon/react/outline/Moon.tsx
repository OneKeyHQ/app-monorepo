import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgMoon = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M20.968 12.767a7 7 0 0 1-9.736-9.735 8.999 8.999 0 1 0 9.736 9.735Z"
    />
  </Svg>
);
export default SvgMoon;
