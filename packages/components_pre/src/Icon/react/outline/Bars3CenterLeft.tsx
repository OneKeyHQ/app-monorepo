import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgBars3CenterLeft = (props: SvgProps) => (
  <Svg
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={1.5}
    stroke="currentColor"
    accessibilityRole="image"
    {...props}
  >
    <Path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M3.75 6.75h16.5M3.75 12H12m-8.25 5.25h16.5"
    />
  </Svg>
);
export default SvgBars3CenterLeft;
