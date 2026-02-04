import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgFileDownload = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M6 2h6v6a2 2 0 0 0 2 2h6v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2m9.207 15.207-2.5 2.5a1 1 0 0 1-1.414 0l-2.5-2.5a1 1 0 1 1 1.414-1.414l.793.793V13a1 1 0 1 1 2 0v3.586l.793-.793a1 1 0 0 1 1.414 1.414"
      clipRule="evenodd"
    />
    <Path d="M14 2.586 19.414 8H14z" />
  </Svg>
);
export default SvgFileDownload;
