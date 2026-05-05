import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgTarget = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M13 4.566a7.48 7.48 0 0 1 4.33 2.158A7.48 7.48 0 0 1 19.435 11H15v2h4.435a7.6 7.6 0 0 0 0-2H23v2h-3.565A7.505 7.505 0 0 1 13 19.434V23h-2v-3.566a7.48 7.48 0 0 1-4.479-2.312A7.48 7.48 0 0 1 4.566 13H1v-2h3.566A7.504 7.504 0 0 1 11 4.566V9h2zM11 15v4.434a7.6 7.6 0 0 0 2 0V15zm-6.434-4a7.6 7.6 0 0 0 0 2H9v-2z"
      clipRule="evenodd"
    />
    <Path d="M13 4.566a7.6 7.6 0 0 0-2 0V1h2z" />
  </Svg>
);
export default SvgTarget;
