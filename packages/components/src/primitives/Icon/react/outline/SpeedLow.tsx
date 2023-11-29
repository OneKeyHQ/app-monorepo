import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgSpeedLow = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="m12 16-3-6m3 6H3.936M12 16h8.064M3.936 16A9 9 0 0 0 12 21a9 9 0 0 0 8.064-5M3.936 16a9 9 0 1 1 16.129 0"
    />
  </Svg>
);
export default SvgSpeedLow;
