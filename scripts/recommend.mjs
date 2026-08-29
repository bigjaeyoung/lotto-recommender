// draws.json을 분석해 이번 주 추천 번호 세트를 생성한다.
// 사용 지표: 출현 빈도, 미출현 기간("저조 번호"), 번호쌍 상관관계, 홀짝/구간/합계 밸런스 필터.
// 주의: 로또는 매회 독립 무작위 추첨이라 이 로직도 실제 당첨 확률을 올리지는 못한다 (분석/재미 목적).
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { generateRecommendationSets } from '../public/lotto-logic.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DRAWS_PATH = path.join(__dirname, '..', 'public', 'data', 'draws.json');
const OUT_PATH = path.join(__dirname, '..', 'public', 'data', 'recommendation.json');

const SET_COUNT = 5;

async function main() {
  const draws = JSON.parse(await readFile(DRAWS_PATH, 'utf-8'));
  const { stats, sets, hotNumbers, coldNumbers } = generateRecommendationSets(draws, SET_COUNT);

  const recommendation = {
    generatedAt: new Date().toISOString(),
    basedOnRounds: stats.latestRound,
    totalDraws: draws.length,
    hotNumbers,
    coldNumbers,
    sets,
  };

  await writeFile(OUT_PATH, JSON.stringify(recommendation, null, 2), 'utf-8');
  console.log(`${stats.latestRound}회까지 데이터 기반으로 추천 ${SET_COUNT}세트 생성 완료`);
  sets.forEach((s, i) => console.log(`  ${i + 1}: ${s.join(', ')}`));
}

main().catch((err) => {
  console.error('추천 생성 실패:', err.message);
  process.exit(1);
});
