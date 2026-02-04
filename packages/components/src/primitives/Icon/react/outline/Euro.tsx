import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgEuro = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M20 12a8 8 0 1 0-16 0 8 8 0 0 0 16 0m-7.5-5c1.307 0 2.458.616 3.259 1.55a1 1 0 1 1-1.518 1.302C13.771 9.304 13.151 9 12.5 9c-1.007 0-1.999.776-2.357 2H11a1 1 0 1 1 0 2h-.857c.358 1.224 1.35 2 2.357 2 .652 0 1.271-.304 1.741-.852a1 1 0 0 1 1.518 1.302c-.801.934-1.952 1.55-3.259 1.55-2.27 0-4-1.797-4.407-4H8a1 1 0 1 1 0-2h.093C8.5 8.797 10.229 7 12.5 7m9.5 5c0 5.523-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2s10 4.477 10 10" />
  </Svg>
);
export default SvgEuro;
