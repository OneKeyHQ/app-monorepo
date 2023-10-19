import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgDebug = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M17.5 6a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm5 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM20 4.75a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm0 2.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm2.5-3.75a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm0 5a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z"
    />
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M8.52 4.534a2 2 0 0 1 2.373-1.54l1.956.415a2 2 0 0 1 1.54 2.372l-.415 1.957a3 3 0 0 1 2.31 3.558l-1.663 7.825a3 3 0 0 1-3.558 2.31l-5.869-1.247a3 3 0 0 1-2.31-3.558l1.663-7.825a3 3 0 0 1 3.558-2.31l.416-1.957Zm1.541 2.372 1.957.416.415-1.956-1.956-.416-.416 1.956Zm-2.176 4.433a1 1 0 0 1 1.383.294l.611.94.94-.61a1 1 0 1 1 1.09 1.677l-.94.61.61.94a1 1 0 1 1-1.677 1.09l-.61-.94-.941.61a1 1 0 1 1-1.09-1.677l.94-.61-.61-.941a1 1 0 0 1 .294-1.383Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgDebug;
