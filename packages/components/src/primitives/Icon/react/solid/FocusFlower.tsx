import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgFocusFlower = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M6 8a6.002 6.002 0 0 0 5 5.917v1.69a6.12 6.12 0 0 0-4.224-1.606A1.796 1.796 0 0 0 5 15.857a6.143 6.143 0 0 0 6 6.141V22h2v-.002a6.143 6.143 0 0 0 6-6.222A1.796 1.796 0 0 0 17.143 14 6.12 6.12 0 0 0 13 15.607v-1.69A6.002 6.002 0 0 0 18 8V4.563a1.55 1.55 0 0 0-2.126-1.44l-1.038.416a.307.307 0 0 1-.306-.046l-.968-.774a2.5 2.5 0 0 0-3.124 0l-.968.774a.307.307 0 0 1-.306.046l-1.038-.416A1.55 1.55 0 0 0 6 4.563V8Zm1.003 8.003a4.143 4.143 0 0 0 3.995 3.994 4.143 4.143 0 0 0-3.995-3.994Zm9.994 0a4.143 4.143 0 0 1-3.995 3.994 4.143 4.143 0 0 1 3.995-3.994Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgFocusFlower;
