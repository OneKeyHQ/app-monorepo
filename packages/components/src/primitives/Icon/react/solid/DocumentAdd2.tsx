import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgDocumentAdd2 = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M4 4.421c0-1.046.848-1.895 1.895-1.895h11.368c1.047 0 1.895.849 1.895 1.895v7.74a2.842 2.842 0 1 0-3.79 8.365c0 .332.057.651.162.948H5.895A1.895 1.895 0 0 1 4 19.579zm2.842 1.895c0-.523.424-.948.947-.948h5.685a.947.947 0 0 1 0 1.895H7.789a.947.947 0 0 1-.947-.947m0 3.79c0-.524.424-.948.947-.948h1.895a.947.947 0 0 1 0 1.895H7.79a.947.947 0 0 1-.947-.948Z"
      clipRule="evenodd"
    />
    <Path d="M19.158 14.842a.947.947 0 1 0-1.895 0v1.895h-1.895a.947.947 0 1 0 0 1.895h1.895v1.894a.947.947 0 1 0 1.895 0v-1.894h1.895a.947.947 0 1 0 0-1.895h-1.895z" />
  </Svg>
);
export default SvgDocumentAdd2;
