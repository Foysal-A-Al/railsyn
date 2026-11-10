// Browser-facing authority stays loopback, even when the container listens internally.
export function getConfig(env = {}) {
  const portText = env.RAILSYN_PORT ?? '8630';
  if (!/^\d+$/.test(portText)) throw new Error('RAILSYN_PORT must be an integer.');
  const port = Number(portText);
  if (port < 1024 || port > 65535) throw new Error('RAILSYN_PORT must be between 1024 and 65535.');
  const host = '127.0.0.1';
  const listenHost = env.RAILSYN_BIND_HOST ?? host;
  if (![host, '0.0.0.0'].includes(listenHost)) throw new Error('Unsupported RAILSYN_BIND_HOST.');
  return {port, host, listenHost, origin: `http://${host}:${port}`};
}
