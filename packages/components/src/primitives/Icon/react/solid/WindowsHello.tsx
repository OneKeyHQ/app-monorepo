import Svg, { SvgProps, Path, Circle } from 'react-native-svg';
const SvgWindowsHello = (props: SvgProps) => (
  <Svg viewBox="0 0 24 24" fill="none" accessibilityRole="image" {...props}>
    <Path
      d="M20 15.583c-.811 1.216-1.978 2.226-3.382 2.928A10.357 10.357 0 0 1 12 19.583c-1.621 0-3.214-.37-4.618-1.072C5.978 17.81 4.812 16.8 4 15.583"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Circle cx={6.5} cy={6.5} r={2.5} fill="currentColor" />
    <Circle cx={17.5} cy={6.5} r={2.5} fill="currentColor" />
  </Svg>
);
export default SvgWindowsHello;
