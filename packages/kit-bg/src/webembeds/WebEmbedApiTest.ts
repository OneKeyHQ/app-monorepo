class WebEmbedApiTest {
  test1(...params: string[]) {
    return Promise.resolve(
      `${params.join('---')}: ${globalThis.location.href}`,
    );
  }
}

export default WebEmbedApiTest;
