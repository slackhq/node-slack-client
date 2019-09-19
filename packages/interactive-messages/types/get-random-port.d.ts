declare module 'get-random-port' {
  function getRandomPort(done: (err: any, port: number) => void): Promise<number>;
  export = getRandomPort;
}
