import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgStopCircle = (props: SvgProps) => (
  <Svg
    viewBox="0 0 20 20"
    fill="currentColor"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M2 10a8 8 0 1 1 16 0 8 8 0 0 1-16 0zm5-2.25A.75.75 0 0 1 7.75 7h4.5a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-.75.75h-4.5a.75.75 0 0 1-.75-.75v-4.5z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgStopCircle;
