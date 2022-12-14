import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgImport = (props: SvgProps) => (
  <Svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" {...props}>
    <Path
      d="M11.707 7.293a1 1 0 1 0-1.414 1.414l1.414-1.414ZM15 12l.707.707.707-.707-.707-.707L15 12Zm-4.707 3.293a1 1 0 1 0 1.414 1.414l-1.414-1.414ZM3 11a1 1 0 1 0 0 2v-2Zm1-3a1 1 0 0 0 2 0H4Zm2 8a1 1 0 1 0-2 0h2Zm4.293-7.293 4 4 1.414-1.414-4-4-1.414 1.414Zm4 2.586-4 4 1.414 1.414 4-4-1.414-1.414ZM15 11H3v2h12v-2ZM7 4h11V2H7v2Zm12 1v14h2V5h-2Zm-1 15H7v2h11v-2ZM6 8V5H4v3h2Zm0 11v-3H4v3h2Zm1 1a1 1 0 0 1-1-1H4a3 3 0 0 0 3 3v-2Zm12-1a1 1 0 0 1-1 1v2a3 3 0 0 0 3-3h-2ZM18 4a1 1 0 0 1 1 1h2a3 3 0 0 0-3-3v2ZM7 2a3 3 0 0 0-3 3h2a1 1 0 0 1 1-1V2Z"
      fill="#8C8CA1"
    />
  </Svg>
);
export default SvgImport;
