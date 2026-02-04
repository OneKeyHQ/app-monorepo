import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgBusiness = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M19 12.887q-.45.111-.942.113a3.9 3.9 0 0 1-2.985-1.393A4.07 4.07 0 0 1 12 13a4.07 4.07 0 0 1-3.074-1.393A3.9 3.9 0 0 1 5.942 13 4 4 0 0 1 5 12.887V19h14zM4.13 8.537a1.898 1.898 0 1 0 3.695.8L8.367 5H5.235L4.13 8.536ZM10.382 5l-.457 3.65.001.001a2.09 2.09 0 1 0 4.148.01L13.617 5zm5.676 3.403.001.019.115.916a1.898 1.898 0 1 0 3.696-.802L18.764 5h-3.132zM21 19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7.343a3.88 3.88 0 0 1-.78-3.717l1.105-3.536A2 2 0 0 1 5.235 3h13.53a2 2 0 0 1 1.908 1.403L21.78 7.94a3.88 3.88 0 0 1-.78 3.718z" />
  </Svg>
);
export default SvgBusiness;
