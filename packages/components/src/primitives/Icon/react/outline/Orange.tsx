import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgOrange = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="m17.085 12.632-.124.992a5 5 0 0 1-4.337 4.337l-.992.124-.248-1.984.992-.124a3 3 0 0 0 2.6-2.6l.125-.993z" />
    <Path
      fillRule="evenodd"
      d="M12.054 2.99C13.142 1.6 15.27-.22 18.616.524l.976.217-.217.976c-.32 1.437-1.035 2.454-1.941 3.137q-.362.269-.743.465a9 9 0 1 1-6.286-1.176c-.54-.57-1.399-1.049-2.494-1.146l-.996-.09.178-1.992.996.09c1.68.15 3.082.937 3.965 1.985M12 6a7 7 0 1 0 0 14 7 7 0 0 0 0-14m5.015-3.642c-1.537.042-2.604.905-3.28 1.728l.61-.094c.677-.106 1.344-.329 1.885-.736.294-.221.563-.512.785-.898"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgOrange;
