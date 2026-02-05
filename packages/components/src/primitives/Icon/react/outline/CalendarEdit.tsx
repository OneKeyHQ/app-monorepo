import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCalendarEdit = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M18.45 13.982a1.98 1.98 0 0 1 2.803 0l.58.581c.775.774.775 2.03 0 2.804l-3.964 3.965c-.372.371-.876.58-1.402.58h-1.572a.99.99 0 0 1-.991-.99v-1.573c0-.526.209-1.03.58-1.401zM4.982 6.053v1.983H18.86V6.053zM15.886 19.93h.581l3.965-3.965-.58-.58-3.966 3.964v.58Zm4.956-9.912a.991.991 0 1 1-1.982 0H4.982v8.92h5.948a.991.991 0 1 1 0 1.983H4.982A1.98 1.98 0 0 1 3 18.94V6.053c0-1.095.888-1.983 1.982-1.983h1.983v-.991a.991.991 0 0 1 1.982 0v.991h5.948v-.991a.991.991 0 0 1 1.982 0v.991h1.983c1.095 0 1.982.888 1.982 1.983z" />
  </Svg>
);
export default SvgCalendarEdit;
