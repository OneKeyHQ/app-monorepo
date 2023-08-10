import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgBars3BottomRight = (props: SvgProps) => (
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
      d="M3.75 6.75h16.5M3.75 12h16.5M12 17.25h8.25"
    />
  </Svg>
);
export default SvgBars3BottomRight;
