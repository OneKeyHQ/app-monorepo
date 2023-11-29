import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgControllerRound = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="square"
      strokeWidth={2}
      d="M14.75 5.75a2.75 2.75 0 1 1-5.5 0 2.75 2.75 0 0 1 5.5 0Zm0 12.5a2.75 2.75 0 1 1-5.5 0 2.75 2.75 0 0 1 5.5 0ZM8.5 12A2.75 2.75 0 1 1 3 12a2.75 2.75 0 0 1 5.5 0ZM21 12a2.75 2.75 0 1 1-5.5 0 2.75 2.75 0 0 1 5.5 0Z"
    />
  </Svg>
);
export default SvgControllerRound;
