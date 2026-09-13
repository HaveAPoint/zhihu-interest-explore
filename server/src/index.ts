import { createApp } from './app.js';

const PORT = parseInt(process.env['PORT'] ?? '9000', 10);
const HOST = process.env['HOST'] ?? '0.0.0.0';

async function main() {
  const app = await createApp();

  try {
    const address = await app.listen({ port: PORT, host: HOST });
    console.log(`Server listening at ${address}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();
