class WebEmbedApiTest {
  test1(...params: string[]) {
    return Promise.resolve(params.join('---'));
  }
}

export default WebEmbedApiTest;
