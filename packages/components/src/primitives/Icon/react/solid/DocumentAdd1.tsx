import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgDocumentAdd1 = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M5.895 2.526A1.895 1.895 0 0 0 4 4.421V19.58c0 1.046.848 1.895 1.895 1.895h9.635a2.8 2.8 0 0 1-.162-.948 2.842 2.842 0 0 1 0-5.684 2.842 2.842 0 0 1 3.79-2.68v-7.74a1.895 1.895 0 0 0-1.895-1.896z" />
    <Path d="M19.158 14.842a.947.947 0 1 0-1.895 0v1.895h-1.895a.947.947 0 1 0 0 1.895h1.895v1.894a.947.947 0 1 0 1.895 0v-1.894h1.895a.947.947 0 1 0 0-1.895h-1.895z" />
  </Svg>
);
export default SvgDocumentAdd1;
