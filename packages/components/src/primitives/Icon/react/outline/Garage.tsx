import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgGarage = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M8.037 12.074v1.982h7.926v-1.982zm0 5.944h7.926v-1.981H8.037zm9.908 0h1.981V9.671L12 5.047 4.074 9.67v8.348h1.981v-5.945c0-1.094.888-1.982 1.982-1.982h7.926c1.094 0 1.982.888 1.982 1.982v5.944Zm3.962 0A1.98 1.98 0 0 1 19.926 20H4.074a1.98 1.98 0 0 1-1.982-1.982V9.671c0-.705.375-1.357.983-1.712l7.926-4.624c.617-.36 1.38-.36 1.998 0l7.925 4.624c.61.355.983 1.007.983 1.712z" />
  </Svg>
);
export default SvgGarage;
