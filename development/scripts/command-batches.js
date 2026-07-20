const DEFAULT_MAX_COMMAND_LENGTH = 24 * 1024;

function estimateArgumentLength(argument) {
  return String(argument).length * 2 + 3;
}

function splitArgumentsByLength({
  command,
  fixedArgs = [],
  values,
  maxCommandLength = DEFAULT_MAX_COMMAND_LENGTH,
}) {
  if (!values.length) {
    return [];
  }

  const fixedLength = [command, ...fixedArgs].reduce(
    (length, argument) => length + estimateArgumentLength(argument),
    0,
  );

  if (fixedLength >= maxCommandLength) {
    throw new Error('The fixed command arguments exceed the batching limit.');
  }

  const batches = [];
  let batch = [];
  let batchLength = fixedLength;

  for (const value of values) {
    const valueLength = estimateArgumentLength(value);
    if (fixedLength + valueLength > maxCommandLength) {
      throw new Error(
        `A single command argument exceeds the batching limit: ${value}`,
      );
    }

    if (batch.length && batchLength + valueLength > maxCommandLength) {
      batches.push(batch);
      batch = [];
      batchLength = fixedLength;
    }

    batch.push(value);
    batchLength += valueLength;
  }

  if (batch.length) {
    batches.push(batch);
  }

  return batches;
}

module.exports = {
  DEFAULT_MAX_COMMAND_LENGTH,
  splitArgumentsByLength,
};
