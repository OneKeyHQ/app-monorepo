import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgCar = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M23 11.686V17a3 3 0 0 1-5.83 1H6.83A3.001 3.001 0 0 1 1 17v-5.5a1 1 0 1 1 0-2h.49l3.102-4.265A3 3 0 0 1 7.018 4h9.944a3 3 0 0 1 2.453 1.274l3.104 4.412H23a1 1 0 1 1 0 2ZM6 12a1 1 0 1 0 0 2h2a1 1 0 1 0 0-2H6Zm10 0a1 1 0 1 0 0 2h2a1 1 0 1 0 0-2h-2Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgCar;
