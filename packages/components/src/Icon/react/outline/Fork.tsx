import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgFork = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeWidth={2}
      d="M6.5 8a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Zm0 0v2a2 2 0 0 0 2 2H10a2 2 0 0 1 2 2m5.5-6a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Zm0 0v2a2 2 0 0 1-2 2H14a2 2 0 0 0-2 2m0 2a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5Zm0 0v-2"
    />
  </Svg>
);
export default SvgFork;
