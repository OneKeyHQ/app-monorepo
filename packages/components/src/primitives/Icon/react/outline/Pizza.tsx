import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgPizza = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="m17.9 22.168-.997-.185a18.53 18.53 0 0 1-9.75-5.136 18.53 18.53 0 0 1-5.136-9.75L1.832 6.1l19.393-3.325zM4.201 7.723a16.5 16.5 0 0 0 4.367 7.709 16.5 16.5 0 0 0 7.708 4.366l.257-1.502a15 15 0 0 1-6.89-3.94 15 15 0 0 1-3.94-6.891zM16 13a2 2 0 0 0-2 2v.155c.918.506 1.882.893 2.873 1.161l.479-2.79-.019-.017A2 2 0 0 0 16 13m.963-7.466a3 3 0 0 1-5.913 1.014l-3.367.577a13 13 0 0 0 3.375 5.816q.525.524 1.09.977a4 4 0 0 1 5.57-2.53l1.057-6.164zm-3.94.676a1 1 0 0 0 1.968-.338z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgPizza;
