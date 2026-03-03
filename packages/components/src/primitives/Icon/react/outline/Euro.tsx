import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgEuro = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M12.5 7c1.307 0 2.458.616 3.259 1.55L14.24 9.852C13.771 9.304 13.151 9 12.5 9c-1.007 0-1.999.776-2.357 2H12v2h-1.857c.358 1.224 1.35 2 2.357 2 .652 0 1.271-.304 1.741-.852l1.518 1.302c-.8.934-1.952 1.55-3.259 1.55-2.27 0-4-1.797-4.407-4H7v-2h1.093C8.5 8.797 10.229 7 12.5 7" />
    <Path
      fillRule="evenodd"
      d="M22 12c0 5.523-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2s10 4.477 10 10m-2 0a8 8 0 1 0-16 0 8 8 0 0 0 16 0"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgEuro;
