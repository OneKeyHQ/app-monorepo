import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgPinFlag = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 17V3l6 3.5-6 3.5m-4 4.364c-2.963.573-5 1.762-5 3.136 0 1.933 4.03 3.5 9 3.5s9-1.567 9-3.5c0-1.374-2.037-2.563-5-3.136"
    />
  </Svg>
);
export default SvgPinFlag;
