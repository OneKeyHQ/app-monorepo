import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgLocationMap = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M8 6h3v2H8v8H5.5a1.5 1.5 0 0 0 0 3H19v-6h2v8H5.5A3.5 3.5 0 0 1 2 17.5v-11A3.5 3.5 0 0 1 5.5 3H8zM5.5 5A1.5 1.5 0 0 0 4 6.5v7.836A3.5 3.5 0 0 1 5.5 14H6V5z"
      clipRule="evenodd"
    />
    <Path
      fillRule="evenodd"
      d="M17 3a4 4 0 0 1 4 4c0 1.664-.993 2.913-1.824 3.675a8.6 8.6 0 0 1-1.676 1.192l-.034.018-.018.009L17 11l.447.895-.447.223-.447-.223L17 11l-.447.895-.001-.001-.018-.01-.034-.017a8 8 0 0 1-.507-.298 8.6 8.6 0 0 1-1.169-.894C13.994 9.913 13 8.665 13 7a4 4 0 0 1 4-4m0 2a2 2 0 0 0-2 2c0 .836.507 1.587 1.176 2.2.292.268.588.482.824.637a6.6 6.6 0 0 0 .824-.637C18.494 8.587 19 7.836 19 7a2 2 0 0 0-2-2"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgLocationMap;
