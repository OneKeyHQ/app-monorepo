import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgGarage = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M11.002 3.335a1.98 1.98 0 0 1 1.996 0l7.927 4.624c.608.355.983 1.007.983 1.712v8.348A1.98 1.98 0 0 1 19.926 20H4.074a1.98 1.98 0 0 1-1.982-1.982V9.671c0-.705.375-1.357.983-1.712zM8.037 18.02h7.926v-1.982H8.037zm0-3.964h7.926v-1.981H8.037z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgGarage;
