// draws.json의 역대 출현 빈도를 기반으로 이번 주 추천 번호 세트를 생성한다.
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DRAWS_PATH = path.join(__dirname, '..', 'public', 'data', 'draws.json');
const OUT_PATH = path.join(__dirname, '..', 'public', 'data', 'recommendation.json');

const SET_COUNT = 5;
const NUMBERS_PER_SET = 6;

function computeFrequency(draws) {
  const freq = new Map();
  for (let n = 1; n <= 45; n += 1) freq.set(n, 0);
  for (const draw of draws) {
    for (const n of draw.numbers) freq.set(n, freq.get(n) + 1);
  }
  return freq;
}

// 가중치(출현 빈도)에 비례한 복원 없는 랜덤 추출로 6개 번호 세트를 만든다.
// 자주 나온 번호일수록 뽑힐 확률이 높아지되, 매번 완전히 같은 조합이 나오지 않도록 무작위성을 남긴다.
function weightedSample(freqMap, count) {
  const pool = [...freqMap.entries()].map(([num, w]) => ({ num, w: w + 1 }));
  const picked = [];
  for (let i = 0; i < count; i += 1) {
    const total = pool.reduce((sum, p) => sum + p.w, 0);
    let r = Math.random() * total;
    let idx = 0;
    for (; idx < pool.length; idx += 1) {
      r -= pool[idx].w;
      if (r <= 0) break;
    }
    picked.push(pool[idx].num);
    pool.splice(idx, 1);
  }
  return picked.sort((a, b) => a - b);
}

async function main() {
  const draws = JSON.parse(await readFile(DRAWS_PATH, 'utf-8'));
  const freq = computeFrequency(draws);
  const latestRound = Math.max(...draws.map((d) => d.round));

  const hotNumbers = [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([num, count]) => ({ num, count }));

  const sets = Array.from({ length: SET_COUNT }, () => weightedSample(freq, NUMBERS_PER_SET));

  const recommendation = {
    generatedAt: new Date().toISOString(),
    basedOnRounds: latestRound,
    totalDraws: draws.length,
    hotNumbers,
    sets,
  };

  await writeFile(OUT_PATH, JSON.stringify(recommendation, null, 2), 'utf-8');
  console.log(`${latestRound}회까지 데이터 기반으로 추천 ${SET_COUNT}세트 생성 완료`);
  sets.forEach((s, i) => console.log(`  ${i + 1}: ${s.join(', ')}`));
}

main().catch((err) => {
  console.error('추천 생성 실패:', err.message);
  process.exit(1);
});
