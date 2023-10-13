import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgCornerLeftUp = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M20 20h-8a4 4 0 0 1-4-4V4.25m4 3.25L8.707 4.207a1 1 0 0 0-1.414 0L4 7.5"
    />
  </Svg>
);
export default SvgCornerLeftUp;
