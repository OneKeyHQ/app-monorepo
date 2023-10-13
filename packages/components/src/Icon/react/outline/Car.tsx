import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgCar = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="m2 10.5 3.401-4.676A2 2 0 0 1 7.018 5h9.944a2 2 0 0 1 1.635.85L22 10.685M2 10.5H1m1 0V17a2 2 0 1 0 4 0h12a2 2 0 1 0 4 0v-6.314m0 0h1M6 13h2m8 0h2"
    />
  </Svg>
);
export default SvgCar;
