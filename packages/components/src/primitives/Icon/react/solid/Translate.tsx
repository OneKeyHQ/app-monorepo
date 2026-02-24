import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgTranslate = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="m22.332 19.481-1.812.85L19.43 18h-4.854l-1.093 2.33-1.81-.849L16.116 10h1.772zM15.512 16h2.98l-1.49-3.178zM9.002 5h4v2h-1.628c-.312 1.912-.929 3.524-1.936 4.818.751.525 1.675.93 2.806 1.212l.97.243-.485 1.94-.97-.243c-1.46-.365-2.716-.928-3.757-1.725-1.04.798-2.297 1.36-3.758 1.725l-.97.243-.485-1.94.97-.243c1.131-.283 2.055-.687 2.805-1.212C5.558 10.524 4.941 8.911 4.63 7H3.002V5h4V3h2zM6.66 7c.266 1.414.716 2.527 1.342 3.401C8.628 9.527 9.078 8.414 9.344 7z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgTranslate;
