import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgDocumentGraph2 = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M18 2a2 2 0 0 1 2 2v5a1 1 0 1 1-2 0V4H6v16h3.75a1 1 0 1 1 0 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" />
    <Path
      fillRule="evenodd"
      d="M18 12.1a5.002 5.002 0 0 1 3.17 7.656l.072.072-1.414 1.414-.072-.072A5 5 0 1 1 16 12.1V12h2zm-2 2.074a2.999 2.999 0 1 0 2.291 5.531l-1.998-1.998A1 1 0 0 1 16 17zm2 2.412 1.705 1.705C19.892 17.9 20 17.463 20 17a3 3 0 0 0-2-2.826z"
      clipRule="evenodd"
    />
    <Path d="M11 10a1 1 0 1 1 0 2H9a1 1 0 1 1 0-2zm4-4a1 1 0 1 1 0 2H9a1 1 0 0 1 0-2z" />
  </Svg>
);
export default SvgDocumentGraph2;
