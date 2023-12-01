import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgConsole = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="m7.5 8 1.146 1.146a.5.5 0 0 1 0 .708L7.5 11m4 0H13m-7 9h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2Z"
    />
  </Svg>
);
export default SvgConsole;
