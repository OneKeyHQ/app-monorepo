import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgDocumentCloud1 = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M6 2a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h5.167A6.25 6.25 0 0 1 20 13.168V4a2 2 0 0 0-2-2z" />
    <Path
      fillRule="evenodd"
      d="M15.75 13.5a4.25 4.25 0 0 0 0 8.5h2.75a3.5 3.5 0 0 0 .523-6.961A4.24 4.24 0 0 0 15.75 13.5m-2.25 4.25a2.25 2.25 0 0 1 4.147-1.21 1 1 0 0 0 .844.46h.009a1.5 1.5 0 0 1 0 3h-2.75a2.25 2.25 0 0 1-2.25-2.25"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgDocumentCloud1;
