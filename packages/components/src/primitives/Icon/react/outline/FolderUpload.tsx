import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgFolderUpload = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M12.535 6H22v14h-6v-2h4V8h-8.535l-2-3H4v13h4v2H2V3h8.535z" />
    <Path d="M15.914 15.5 14.5 16.914l-1.5-1.5V20h-2v-4.586l-1.5 1.5L8.086 15.5 12 11.586z" />
  </Svg>
);
export default SvgFolderUpload;
