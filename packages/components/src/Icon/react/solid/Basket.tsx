import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgBasket = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M9.428 4.372a1 1 0 0 0-1.856-.743L5.823 8H4a.996.996 0 0 0-.449.106 2.001 2.001 0 0 0-1.32 2.252l1.486 8.179A3 3 0 0 0 6.67 21h10.66a3 3 0 0 0 2.951-2.463l1.487-8.18a2.001 2.001 0 0 0-1.319-2.25A.996.996 0 0 0 20 8h-1.823l-1.748-4.371a1 1 0 0 0-1.857.743L16.021 8H7.978l1.451-3.628Z"
    />
  </Svg>
);
export default SvgBasket;
