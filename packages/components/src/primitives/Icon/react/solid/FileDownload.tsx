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
      d="M12 10h8v12H4V2h8zm-1 6.586-1.5-1.5L8.086 16.5 12 20.414l3.914-3.914-1.414-1.414-1.5 1.5V12h-2z"
      clipRule="evenodd"
    />
    <Path d="M19.414 8H14V2.586z" />
  </Svg>
);
export default SvgFileDownload;
