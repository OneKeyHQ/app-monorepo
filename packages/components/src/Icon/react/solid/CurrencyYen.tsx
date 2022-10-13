import Svg, { SvgProps, Path } from 'react-native-svg';

const SvgCurrencyYen = (props: SvgProps) => (
  <Svg viewBox="0 0 20 20" fill="currentColor" {...props}>
    <Path
      fillRule="evenodd"
      d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM7.858 5.485a1 1 0 0 0-1.715 1.03L7.633 9H7a1 1 0 1 0 0 2h1.834l.166.277V12H7a1 1 0 1 0 0 2h2v1a1 1 0 1 0 2 0v-1h2a1 1 0 1 0 0-2h-2v-.723l.166-.277H13a1 1 0 1 0 0-2h-.634l1.492-2.486a1 1 0 1 0-1.716-1.029L10.034 9h-.068L7.858 5.485z"
      clipRule="evenodd"
    />
  </Svg>
);

export default SvgCurrencyYen;
