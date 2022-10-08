import Svg, { SvgProps, Path } from 'react-native-svg';

const SvgOnekeyLite = (props: SvgProps) => (
  <Svg viewBox="0 0 24 24" fill="none" {...props}>
    <Path
      d="M7 11a1 1 0 1 0 0 2v-2Zm1 2a1 1 0 1 0 0-2v2Zm-1 1a1 1 0 1 0 0 2v-2Zm5 2a1 1 0 1 0 0-2v2Zm5-8a1 1 0 1 0 0 2V8Zm.01 2a1 1 0 0 0 0-2v2ZM6 6h12V4H6v2Zm14 2v8h2V8h-2Zm-2 10H6v2h12v-2ZM4 16V8H2v8h2Zm2 2a2 2 0 0 1-2-2H2a4 4 0 0 0 4 4v-2Zm14-2a2 2 0 0 1-2 2v2a4 4 0 0 0 4-4h-2ZM18 6a2 2 0 0 1 2 2h2a4 4 0 0 0-4-4v2ZM6 4a4 4 0 0 0-4 4h2a2 2 0 0 1 2-2V4Zm1 9h1v-2H7v2Zm0 3h5v-2H7v2Zm10-6h.01V8H17v2Z"
      fill="currentColor"
    />
  </Svg>
);

export default SvgOnekeyLite;
