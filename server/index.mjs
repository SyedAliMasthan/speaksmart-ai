import { createApp } from './app.mjs';
import { loadConfig } from './security.mjs';
const config = loadConfig();
if (!Number.isInteger(config.port) || config.port < 1024 || config.port > 65535) throw new Error('PORT must be an unprivileged TCP port.');
const server = createApp(config);
server.listen(config.port, config.host, () => console.log('SpeakSmart API is listening on loopback.'));
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => {
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 30000).unref();
});
