import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgEuro = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M12 2c5.523 0 10 4.477 10 10s-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2m.5 5c-2.27 0-4 1.797-4.408 4H7v2h1.092c.408 2.203 2.137 4 4.408 4 1.307 0 2.458-.616 3.259-1.55l-1.518-1.302c-.47.548-1.09.852-1.741.852-1.007 0-2.002-.776-2.36-2H12v-2h-1.86c.358-1.224 1.353-2 2.36-2 .652 0 1.271.304 1.741.852L15.76 8.55C14.959 7.616 13.807 7 12.5 7"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgEuro;
