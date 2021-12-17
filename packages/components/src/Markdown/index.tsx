import React, { FC } from 'react';

import RNMarkdown from 'react-native-markdown-display';

import { useThemeValue } from '../Provider/hooks';
// all markdown style
// https://github.com/iamacup/react-native-markdown-display/blob/master/src/lib/styles.js

const Markdown: FC = ({ children }) => {
  const textColor = useThemeValue('text-default');
  const bgColor = useThemeValue('surface-default');
  return (
    <RNMarkdown
      style={{
        body: { color: textColor },
        code_inline: { padding: 2, backgroundColor: bgColor, borderWidth: 0 },
        blockquote: { backgroundColor: bgColor, borderWidth: 0 },
        code_block: { backgroundColor: bgColor, borderWidth: 0 },
        fence: { backgroundColor: bgColor, borderWidth: 0 },
      }}
    >
      {children}
    </RNMarkdown>
  );
};

export default Markdown;
