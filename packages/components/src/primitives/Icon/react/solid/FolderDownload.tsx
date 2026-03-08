import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgFolderDownload = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M12.535 6H22v14H2V3h8.535zM11 10v4.586l-1.5-1.5L8.086 14.5 12 18.414l3.914-3.914-1.414-1.414-1.5 1.5V10z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgFolderDownload;
