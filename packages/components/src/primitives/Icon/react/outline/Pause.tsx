import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgPause = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeWidth={2}
      d="M5 6a2 2 0 1 1 4 0v12a2 2 0 1 1-4 0V6Zm10 0a2 2 0 1 1 4 0v12a2 2 0 1 1-4 0V6Z"
    />
  </Svg>
);
export default SvgPause;
