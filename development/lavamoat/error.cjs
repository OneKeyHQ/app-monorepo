// cspell:ignore LavaMoat

class LavaMoatError extends Error {
  constructor(message) {
    super(message);
    this.name = 'LavaMoatError';
  }
}

module.exports = { LavaMoatError };
