import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgFolderDownload = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M12.535 6H22v14h-6v-2h4V8h-8.535l-2-3H4v13h4v2H2V3h8.535z" />
    <Path d="m13 15.586 1.5-1.5 1.414 1.414L12 19.414 8.086 15.5 9.5 14.086l1.5 1.5V11h2z" />
  </Svg>
);
export default SvgFolderDownload;
