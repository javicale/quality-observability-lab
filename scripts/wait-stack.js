const targets = [
  ['Grafana', 'http://127.0.0.1:3001/api/health'],
  ['Tempo', 'http://127.0.0.1:3200/ready'],
  ['Loki', 'http://127.0.0.1:3100/ready'],
  ['Prometheus', 'http://127.0.0.1:9090/-/ready'],
];

async function waitFor(name, url, timeoutMs = 180000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        console.log(`${name} ready`);
        return;
      }
      lastError = new Error(`${name} returned HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  throw new Error(`${name} was not ready within ${timeoutMs / 1000}s: ${lastError?.message || 'unknown error'}`);
}

for (const [name, url] of targets) await waitFor(name, url);
console.log('LGTM stack ready');
