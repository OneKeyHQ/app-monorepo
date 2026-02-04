import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgDollar = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10S2 17.523 2 12m10-6.5a1 1 0 0 1 1 1v.624c.804.203 1.514.65 1.976 1.29a1 1 0 0 1-1.62 1.172C13.137 9.286 12.652 9 12 9h-.278c-.895 0-1.222.545-1.222.778v.076c0 .197.15.529.652.73l2.438.975c1.067.427 1.91 1.38 1.91 2.587 0 1.473-1.177 2.468-2.5 2.763v.591a1 1 0 1 1-2 0v-.624c-.804-.203-1.514-.65-1.976-1.29a1 1 0 0 1 1.62-1.172c.218.3.703.586 1.356.586h.182c.948 0 1.318-.58 1.318-.854 0-.197-.15-.529-.652-.73l-2.438-.975c-1.067-.427-1.91-1.38-1.91-2.587v-.076c0-1.464 1.19-2.439 2.5-2.705V6.5a1 1 0 0 1 1-1"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgDollar;
