import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgBusiness = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M21.779 7.94a3.88 3.88 0 0 1-.78 3.718V21H3v-9.345a3.88 3.88 0 0 1-.778-3.716L3.764 3h16.47zm-6.706 3.667A4.07 4.07 0 0 1 12 13a4.07 4.07 0 0 1-3.074-1.393A3.89 3.89 0 0 1 5 12.886V19h14v-6.113q-.45.111-.942.113a3.9 3.9 0 0 1-2.985-1.393M4.13 8.537a1.898 1.898 0 1 0 3.695.8L8.367 5H5.235L4.13 8.536Zm5.795.113za2.09 2.09 0 1 0 4.148.01L13.617 5h-3.235zm6.133-.247.001.019.115.916a1.899 1.899 0 1 0 3.696-.802L18.765 5h-3.133z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgBusiness;
