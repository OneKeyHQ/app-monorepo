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
      d="M20 12h-3.773l-1.175 3.052L12 16.227v3.546l3.052 1.174.405 1.053H4V2h16zM7 9v2h5V9zm0-4v2h8V5z"
      clipRule="evenodd"
    />
    <Path d="m19.4 16.6 2.6 1v.8l-2.6 1-1 2.6h-.8l-1-2.6-2.6-1v-.8l2.6-1 1-2.6h.8z" />
  </Svg>
);
export default SvgDocumentAdd2;
