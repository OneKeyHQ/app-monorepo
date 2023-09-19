import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgChartLineSquare = (props: SvgProps) => (
  <Svg
    viewBox="0 0 24 24"
    fill="currentColor"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M6.97 13.667a.75.75 0 1 0 1.06 1.06l-1.06-1.06Zm3.53-2.47.53-.53a.75.75 0 0 0-1.06 0l.53.53Zm2.148 2.148-.53.53a.75.75 0 0 0 1.145-.101l-.615-.43Zm4.227-2.893a.75.75 0 1 0-.75-1.299l.75 1.299ZM8.03 14.728l3-3-1.06-1.061-3 3 1.06 1.06Zm1.94-3 2.147 2.147 1.06-1.06-2.147-2.148-1.06 1.06Zm3.293 2.046a11.312 11.312 0 0 1 3.612-3.322l-.75-1.299a12.811 12.811 0 0 0-4.093 3.763l1.23.858ZM6 4.5h12V3H6v1.5ZM19.5 6v12H21V6h-1.5ZM18 19.5H6V21h12v-1.5ZM4.5 18V6H3v12h1.5ZM6 19.5A1.5 1.5 0 0 1 4.5 18H3a3 3 0 0 0 3 3v-1.5ZM19.5 18a1.5 1.5 0 0 1-1.5 1.5V21a3 3 0 0 0 3-3h-1.5ZM18 4.5A1.5 1.5 0 0 1 19.5 6H21a3 3 0 0 0-3-3v1.5ZM6 3a3 3 0 0 0-3 3h1.5A1.5 1.5 0 0 1 6 4.5V3Z" />
  </Svg>
);
export default SvgChartLineSquare;
