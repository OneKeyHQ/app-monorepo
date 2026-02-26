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
      d="m20.235 3 1.543 4.94A3.88 3.88 0 0 1 21 11.66V21H3v-9.34a3.88 3.88 0 0 1-.78-3.72L3.766 3zM4.13 8.536a1.898 1.898 0 1 0 3.695.802l.114-.918.002-.017L8.367 5H5.235zM10.383 5l-.458 3.663a2.09 2.09 0 1 0 4.15.003L13.617 5zm5.25 0 .425 3.403.003.02.114.915a1.898 1.898 0 1 0 3.694-.802L18.765 5z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgBusiness;
