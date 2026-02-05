import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgPassword = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M17.675 11.32a3 3 0 0 1 1.25 5.728v1.272l-.75.75.75.677v.833a.5.5 0 0 1-.187.39l-.75.6a.5.5 0 0 1-.625 0l-.75-.6a.5.5 0 0 1-.188-.39v-3.532a3 3 0 0 1 1.25-5.728m0 2a1 1 0 1 0 0 2 1 1 0 0 0 0-2"
      clipRule="evenodd"
    />
    <Path d="M11.676 12.32q.708 0 1.373.102a5 5 0 0 0-.374 1.898 4.99 4.99 0 0 0 1.75 3.799v3.201h-9.15c-1.135 0-2.192-1.014-1.902-2.303.857-3.813 4.004-6.697 8.303-6.697m-.001-10a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9" />
  </Svg>
);
export default SvgPassword;
