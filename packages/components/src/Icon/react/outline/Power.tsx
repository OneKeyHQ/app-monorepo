import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgPower = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M7.023 4.5a9 9 0 1 0 9.953 0M12 2v5"
    />
  </Svg>
);
export default SvgPower;
