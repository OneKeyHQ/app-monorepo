import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgPause = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M4 6a3 3 0 0 1 6 0v12a3 3 0 1 1-6 0V6Zm10 0a3 3 0 1 1 6 0v12a3 3 0 1 1-6 0V6Z"
    />
  </Svg>
);
export default SvgPause;
