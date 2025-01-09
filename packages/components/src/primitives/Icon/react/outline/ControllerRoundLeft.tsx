import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgControllerRoundLeft = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="square"
      strokeWidth={2}
      d="M9.25 5.75a2.75 2.75 0 1 0 5.5 0 2.75 2.75 0 0 0-5.5 0Zm0 12.5a2.75 2.75 0 1 0 5.5 0 2.75 2.75 0 0 0-5.5 0ZM15.5 12a2.75 2.75 0 1 0 5.5 0 2.75 2.75 0 0 0-5.5 0Z"
    />
    <Path
      fill="currentColor"
      stroke="currentColor"
      strokeLinecap="square"
      strokeWidth={2}
      d="M3 12a2.75 2.75 0 1 0 5.5 0A2.75 2.75 0 0 0 3 12Z"
    />
  </Svg>
);
export default SvgControllerRoundLeft;
