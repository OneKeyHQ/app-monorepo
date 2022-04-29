const emojiList = [
  '🐯',
  '🦁',
  '🐶',
  '🐼',
  '🐵',
  '🦊',
  '🐭',
  '🐻',
  '🐹',
  '🐨',
  '🐷',
  '🐮',
  '🐰',
  '🐸',
  '🐱',
  '🐔',
  '🐧',
  '🐣',
  '🦄',
  '🐺',
  '🐴',
  '🐳',
  '🦋',
  '🐙',
  '🦖',
  '🦑',
  '🐡',
  '🐠',
  '🐬',
  '🐲',
  '🤑',
  '🤠',
  '😎',
  '🤩',
  '🤯',
  '😋',
  '😛',
  '🤪',
  '😀',
  '😷',
  '💩',
  '👽',
  '🤖',
  '👻',
  '🦸‍♀️',
  '🦸‍♂️',
  '🦸',
  '🧙🏼‍♂️',
  '👩‍🚀',
  '👨🏽‍🚀',
  '👨‍🚀',
  '🌈',
] as const;

export type EmojiTypes = typeof emojiList[number];

const colors = [
  '#3D3D4D',
  '#E49090',
  '#E3B167',
  '#91BC76',
  '#67BEA9',
  '#55A9D9',
  '#AB7DCF',
  '#DF9BD0',
];

export type Avatar = {
  emoji: EmojiTypes;
  bgColor: string;
};

export const defaultAvatar: Avatar = { emoji: '🤑', bgColor: '#55A9D9' };

function getRandomInt(max: number) {
  return Math.floor(Math.random() * max);
}

export function randomAvatar(): Avatar {
  return {
    emoji: emojiList[getRandomInt(emojiList.length)],
    bgColor: colors[getRandomInt(colors.length)],
  };
}
