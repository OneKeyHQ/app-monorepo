import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgCube = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 12v9m0-9 8-4.5M12 12 4 7.5m7.02-3.948-6 3.375A2 2 0 0 0 4 8.67v6.66a2 2 0 0 0 1.02 1.743l6 3.375a2 2 0 0 0 1.96 0l6-3.375A2 2 0 0 0 20 15.33V8.67a2 2 0 0 0-1.02-1.743l-6-3.375a2 2 0 0 0-1.96 0Z"
    />
  </Svg>
);
export default SvgCube;
