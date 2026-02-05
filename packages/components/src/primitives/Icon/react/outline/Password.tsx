import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgPassword = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M12.176 12.5a1 1 0 0 1 0 2c-3.241 0-5.61 2.098-6.319 5h8.32a1 1 0 0 1 0 2H5.774c-1.135 0-2.192-1.015-1.902-2.304l.087-.354c.967-3.636 4.052-6.342 8.216-6.342Z" />
    <Path
      fillRule="evenodd"
      d="M17.175 10.5a3 3 0 0 1 1.25 5.727V17.5l-.75.75.75.677v.833a.5.5 0 0 1-.187.39l-.75.6a.5.5 0 0 1-.625 0l-.75-.6a.5.5 0 0 1-.188-.39v-3.533a3 3 0 0 1 1.25-5.727m0 2a1 1 0 1 0 0 2 1 1 0 0 0 0-2m-4.999-10a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9m0 2a2.5 2.5 0 1 0 .001 5 2.5 2.5 0 0 0 0-5Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgPassword;
