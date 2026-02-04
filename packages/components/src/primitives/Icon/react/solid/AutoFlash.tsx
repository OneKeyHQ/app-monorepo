import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgAutoFlash = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M12.577 3.637c0-1.293-1.677-1.8-2.394-.725L3.155 13.453a1.307 1.307 0 0 0 1.088 2.032h4.849v4.878c0 1.293 1.677 1.8 2.394.725l7.027-10.541a1.307 1.307 0 0 0-1.087-2.032h-4.85V3.637Z" />
    <Path
      fillRule="evenodd"
      d="M19.048 13.757c.347.063.622.33.696.674l1.307 6.099a.871.871 0 0 1-1.704.365l-.133-.618h-2.927l-.583.907a.871.871 0 0 1-1.466-.943l3.92-6.098a.87.87 0 0 1 .89-.386m-1.64 4.777h1.433l-.358-1.672-1.076 1.672Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgAutoFlash;
