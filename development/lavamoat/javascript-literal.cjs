// Keep fixture data inert when embedding it in JavaScript or an HTML script.
function javascriptLiteral(value) {
  const serialized = JSON.stringify(value);
  if (serialized === undefined) return 'undefined';
  return serialized.replace(
    /[<>&\u2028\u2029]/g,
    (character) =>
      `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`,
  );
}

module.exports = { javascriptLiteral };
