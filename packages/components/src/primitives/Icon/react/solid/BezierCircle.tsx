import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgBezierCircle = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M2 13.5A1.5 1.5 0 0 0 3.5 15h1.082A8.02 8.02 0 0 0 9 19.418V20.5a1.5 1.5 0 0 0 1.5 1.5h3a1.5 1.5 0 0 0 1.5-1.5v-1.082A8.02 8.02 0 0 0 19.418 15H20.5a1.5 1.5 0 0 0 1.5-1.5v-3A1.5 1.5 0 0 0 20.5 9h-1.082A8.02 8.02 0 0 0 15 4.582V3.5A1.5 1.5 0 0 0 13.5 2h-3A1.5 1.5 0 0 0 9 3.5v1.082A8.02 8.02 0 0 0 4.582 9H3.5A1.5 1.5 0 0 0 2 10.5zm7.027 3.713a6.03 6.03 0 0 1-2.24-2.24A1.5 1.5 0 0 0 8 13.5v-3a1.5 1.5 0 0 0-1.213-1.473 6.03 6.03 0 0 1 2.24-2.24A1.5 1.5 0 0 0 10.5 8h3a1.5 1.5 0 0 0 1.473-1.213 6.03 6.03 0 0 1 2.24 2.24A1.5 1.5 0 0 0 16 10.5v3a1.5 1.5 0 0 0 1.213 1.473 6.03 6.03 0 0 1-2.24 2.24A1.5 1.5 0 0 0 13.5 16h-3a1.5 1.5 0 0 0-1.473 1.213"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgBezierCircle;
