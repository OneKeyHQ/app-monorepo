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
      d="M20 8.586V22h-4v-2h2V10h-6V4H6v16h2v2H4V2h9.414zM14 8h2.586L14 5.414z"
      clipRule="evenodd"
    />
    <Path d="m13 17.586 1.5-1.5 1.414 1.414L12 21.414 8.086 17.5 9.5 16.086l1.5 1.5V13h2z" />
  </Svg>
);
export default SvgFileDownload;
