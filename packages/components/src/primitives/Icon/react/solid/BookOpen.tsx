import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgBookOpen = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M7 4a4 4 0 0 1 4 4v13.256a2.7 2.7 0 0 0-.877-.884c-.4-.247-.88-.372-1.4-.372H3a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zm14 0a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-5.723c-.52 0-1 .125-1.4.372-.359.222-.66.526-.877.884V8a4 4 0 0 1 4-4z" />
  </Svg>
);
export default SvgBookOpen;
