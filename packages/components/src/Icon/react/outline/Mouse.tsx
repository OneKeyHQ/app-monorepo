import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgMouse = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 7v2m0 12a6 6 0 0 1-6-6V9a6 6 0 1 1 12 0v6a6 6 0 0 1-6 6Z"
    />
  </Svg>
);
export default SvgMouse;
