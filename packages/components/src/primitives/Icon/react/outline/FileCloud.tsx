import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgFileCloud = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M6.25 13.5c1.319 0 2.492.602 3.269 1.538A3.5 3.5 0 0 1 9 22H6.25a4.25 4.25 0 0 1 0-8.5m0 2a2.25 2.25 0 0 0 0 4.5H9a1.5 1.5 0 0 0 0-3h-.562l-.294-.46A2.24 2.24 0 0 0 6.25 15.5"
      clipRule="evenodd"
    />
    <Path
      fillRule="evenodd"
      d="M20 8.586V22h-6v-2h4V10h-6V4H6v7.5H4V2h9.414zM14 8h2.586L14 5.414z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgFileCloud;
