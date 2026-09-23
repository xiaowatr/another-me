import fs from 'node:fs';
try {
  const runtime = JSON.parse(fs.readFileSync(new URL('../.local/runtime.json', import.meta.url), 'utf8'));
  const response = await fetch('http://127.0.0.1:5173/api/stop', {method:'POST',headers:{'X-Stop-Token':runtime.token}});
  console.log(response.ok ? 'another me 本地服务已停止。' : '未能停止服务，请在启动窗口按 Ctrl+C。');
} catch { console.log('服务未运行，或无法连接。请检查启动窗口。'); }
