class WebEmbedApiTest {
  test1(...params: string[]) {
    return Promise.resolve(`${params.join('---')}: ${global.location.href}`);
  }
}

export default WebEmbedApiTest;
