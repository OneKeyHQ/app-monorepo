import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgPeopleTogether = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M9 12c4.841 0 9 3.46 9 8v1H0v-1c0-4.54 4.159-8 9-8m0 2c-3.572 0-6.35 2.244-6.9 5h13.8c-.55-2.756-3.328-5-6.9-5"
      clipRule="evenodd"
    />
    <Path d="M18.334 12.566C21.585 13.718 24 16.56 24 20v1h-4.5v-2h2.4c-.398-2.02-1.985-3.752-4.234-4.549l-.942-.334.668-1.885z" />
    <Path
      fillRule="evenodd"
      d="M9 2a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9m0 2a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5"
      clipRule="evenodd"
    />
    <Path d="M15 2a4.5 4.5 0 1 1 0 9h-1V9h1a2.5 2.5 0 0 0 0-5h-1V2z" />
  </Svg>
);
export default SvgPeopleTogether;
