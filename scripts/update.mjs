// 매주 금요일 cron이 호출: 최신 회차만 갱신하고 추천 번호를 새로 생성한 뒤 macOS 알림을 띄운다.
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function run(script, args = []) {
  return new Promise((resolve, reject) => {
    execFile('node', [path.join(__dirname, script), ...args], (err, stdout, stderr) => {
      if (err) return reject(new Error(stderr || err.message));
      process.stdout.write(stdout);
      resolve(stdout);
    });
  });
}

function notify(message) {
  const script = `display notification "${message.replace(/"/g, '\\"')}" with title "로또 번호 추천"`;
  execFile('osascript', ['-e', script], () => {});
}

async function main() {
  await run('fetch-draws.mjs', ['--latest']);
  const out = await run('recommend.mjs');
  const firstSet = out.split('\n').find((l) => l.trim().startsWith('1:'));
  notify(firstSet ? `이번 주 추천: ${firstSet.replace('1:', '').trim()}` : '이번 주 추천 번호가 갱신되었습니다.');
}

main().catch((err) => {
  console.error('업데이트 실패:', err.message);
  notify('당첨번호 업데이트에 실패했습니다.');
  process.exit(1);
});
