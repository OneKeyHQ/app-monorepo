import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgDocumentSearch2 = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M6 2a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h5.81A6.5 6.5 0 0 1 20 12.022V4a2 2 0 0 0-2-2z" />
    <Path
      fillRule="evenodd"
      d="M16.5 13a4.5 4.5 0 1 0 2.414 8.298l.867.897a1 1 0 0 0 1.438-1.39l-.898-.928A4.5 4.5 0 0 0 16.5 13M14 17.5a2.5 2.5 0 1 1 5 0 2.5 2.5 0 0 1-5 0"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgDocumentSearch2;
