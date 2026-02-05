import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgLocationMap = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M2.5 17.5v-11A3.5 3.5 0 0 1 6 3h1.5a1 1 0 0 1 1 1v2h2a1 1 0 1 1 0 2h-2v7a1 1 0 0 1-1 1H6a1.5 1.5 0 0 0 0 3h13.5v-5a1 1 0 1 1 2 0v5a2 2 0 0 1-2 2H6a3.5 3.5 0 0 1-3.5-3.5m15.447-5.605a1 1 0 0 1-.894 0L17.5 11zM19.5 7a2 2 0 1 0-4 0c0 .836.507 1.587 1.176 2.2.292.268.588.482.824.637a6.6 6.6 0 0 0 .824-.637c.67-.613 1.176-1.364 1.176-2.2m2 0c0 1.664-.993 2.913-1.824 3.675A8.6 8.6 0 0 1 18 11.867l-.034.018-.018.009L17.5 11l-.447.895-.001-.001-.018-.01-.034-.017a8 8 0 0 1-.507-.298 8.6 8.6 0 0 1-1.169-.894C14.494 9.913 13.5 8.665 13.5 7a4 4 0 1 1 8 0m-17 7.336A3.5 3.5 0 0 1 6 14h.5V5H6a1.5 1.5 0 0 0-1.5 1.5z" />
  </Svg>
);
export default SvgLocationMap;
