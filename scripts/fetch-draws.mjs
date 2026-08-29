// 동행복권 로또 6/45 전체 회차 당첨번호를 받아 public/data/draws.json 으로 저장한다.
import { writeFile, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_PATH = path.join(__dirname, '..', 'public', 'data', 'draws.json');
const ENDPOINT = 'https://www.dhlottery.co.kr/lt645/selectPstLt645InfoNew.do';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

async function fetchWindow(round) {
  const url = `${ENDPOINT}?srchDir=center&srchLtEpsd=${round}`;
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for round window ${round}`);
  const json = await res.json();
  return json?.data?.list ?? [];
}

function toDraw(item) {
  return {
    round: item.ltEpsd,
    date: `${item.ltRflYmd.slice(0, 4)}-${item.ltRflYmd.slice(4, 6)}-${item.ltRflYmd.slice(6, 8)}`,
    numbers: [item.tm1WnNo, item.tm2WnNo, item.tm3WnNo, item.tm4WnNo, item.tm5WnNo, item.tm6WnNo].sort((a, b) => a - b),
    bonus: item.bnsWnNo,
  };
}

async function loadExisting() {
  try {
    const raw = await readFile(OUT_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

async function fetchAll({ onlyLatest = false, sleepMs = 150 } = {}) {
  const byRound = new Map();
  const existing = await loadExisting();
  existing.forEach((d) => byRound.set(d.round, d));

  if (onlyLatest) {
    // 최근 회차만 확인해서 새로 추가된 회차만 병합
    const probe = existing.length ? Math.max(...existing.map((d) => d.round)) + 15 : 15;
    const list = await fetchWindow(probe);
    list.forEach((item) => byRound.set(item.ltEpsd, toDraw(item)));
  } else {
    // 1회차부터 최신 회차까지 전체 백필 (10개씩 겹치는 창으로 순회, 빈 응답이 나오면 종료)
    let round = 5;
    let emptyStreak = 0;
    while (emptyStreak < 2) {
      const list = await fetchWindow(round);
      if (list.length === 0) {
        emptyStreak += 1;
      } else {
        emptyStreak = 0;
        list.forEach((item) => byRound.set(item.ltEpsd, toDraw(item)));
      }
      round += 10;
      await new Promise((r) => setTimeout(r, sleepMs));
    }
  }

  const draws = [...byRound.values()].sort((a, b) => a.round - b.round);
  await writeFile(OUT_PATH, JSON.stringify(draws, null, 2), 'utf-8');
  return draws;
}

const onlyLatest = process.argv.includes('--latest');

fetchAll({ onlyLatest }).then((draws) => {
  const latest = draws[draws.length - 1];
  console.log(`총 ${draws.length}개 회차 저장 완료 (최신: ${latest.round}회, ${latest.date})`);
}).catch((err) => {
  console.error('당첨번호 수집 실패:', err.message);
  process.exit(1);
});
