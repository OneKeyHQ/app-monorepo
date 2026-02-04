import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgShip = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M12.485 11.09a2 2 0 0 0-.97 0l-6.898 1.725c-2.975.744-.716 4.296.163 5.765l-1.997.444a1 1 0 0 0 .434 1.952l4.283-.952 4.066.904a2 2 0 0 0 .868 0l4.066-.904 4.283.952a1 1 0 0 0 .434-1.952l-1.997-.444c.879-1.469 3.139-5.021.163-5.765l-6.898-1.724Z" />
    <Path
      fillRule="evenodd"
      d="M9 3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3h2a2 2 0 0 1 2 2v2.658L12.97 9.15a4 4 0 0 0-1.94 0L5 10.658V8a2 2 0 0 1 2-2h2z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgShip;
