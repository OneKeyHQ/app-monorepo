import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCursorBox = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="m23.456 14.145-5.73 3.58-3.581 5.731-3.582-12.893zm-8.6 4.399 1.418-2.27 2.27-1.419-5.107-1.418z"
      clipRule="evenodd"
    />
    <Path d="M21 11h-2V5H5v14h6v2H3V3h18z" />
  </Svg>
);
export default SvgCursorBox;
