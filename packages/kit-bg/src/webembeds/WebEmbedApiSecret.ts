class WebEmbedApiSecret {
  show({ name }: { name: string }) {
    // throw new Error('WebEmbedApiSecret show error!');
    return Promise.resolve(`${111}---${name}`);
  }

  hi() {
    return Promise.resolve(2);
  }
}

export default WebEmbedApiSecret;
