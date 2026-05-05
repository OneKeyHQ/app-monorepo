import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgShield2Off = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="m23.405 19.844-1.25 1.561-3.266-2.613A9 9 0 0 1 3 13V6.081L.594 4.156l1.249-1.561zM5 13a7 7 0 0 0 12.326 4.542L5 7.681z"
      clipRule="evenodd"
    />
    <Path d="M21 5.346V13c0 .741-.09 1.46-.259 2.15l-1.778-1.423A7 7 0 0 0 19 13V6.654L12 3.59 8.31 5.205l-1.763-1.41L12 1.407z" />
  </Svg>
);
export default SvgShield2Off;
