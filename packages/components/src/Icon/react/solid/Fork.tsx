import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgFork = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M3 5.5a3.5 3.5 0 1 1 4.5 3.355V10a1 1 0 0 0 1 1H10c.768 0 1.47.289 2 .764A2.989 2.989 0 0 1 14 11h1.5a1 1 0 0 0 1-1V8.855A3.502 3.502 0 0 1 17.5 2a3.5 3.5 0 0 1 1 6.855V10a3 3 0 0 1-3 3H14a1 1 0 0 0-1 1v1.145A3.502 3.502 0 0 1 12 22a3.5 3.5 0 0 1-1-6.855V14a1 1 0 0 0-1-1H8.5a3 3 0 0 1-3-3V8.855A3.502 3.502 0 0 1 3 5.5Z"
    />
  </Svg>
);
export default SvgFork;
