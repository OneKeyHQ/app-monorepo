import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgPlusSmall = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth={2}
      d="M12 7v5m0 0v5m0-5H7m5 0h5"
    />
  </Svg>
);
export default SvgPlusSmall;
