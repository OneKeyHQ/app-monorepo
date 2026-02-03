import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgRocketLaunch = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="m15 14.912-3 2.55v1.772l3-1.8zm-5 2.502L6.586 14h-1.82c-1.554 0-2.515-1.696-1.715-3.029l1.8-3a2 2 0 0 1 1.715-.97h4.249c2.524-2.671 5.386-4.632 9.1-4.954a1.88 1.88 0 0 1 2.038 2.039c-.322 3.713-2.283 6.575-4.953 9.1v4.248a2 2 0 0 1-.971 1.715l-3 1.8c-1.333.8-3.029-.16-3.029-1.715zM9.088 9H6.566l-1.8 3h1.772zM2 19a3 3 0 1 1 3 3H4a2 2 0 0 1-2-2z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgRocketLaunch;
