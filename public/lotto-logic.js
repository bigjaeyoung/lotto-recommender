// 로또 추천 로직 (Node 스크립트와 브라우저 양쪽에서 공유).
//
// 중요: 로또는 매회 독립적인 기계식 무작위 추첨이므로, 아래 어떤 지표를 쓰더라도
// 실제 당첨 확률(6/45 기준 8,145,060분의 1)은 절대 올라가지 않는다.
// 이 로직은 과거 데이터를 여러 통계 지표로 분석해 "그럴듯한" 조합을 만드는
// 분석/재미 목적의 가중 무작위 추출이며, 예측 시스템이 아니다.

export function computeStats(draws) {
  const latestRound = Math.max(...draws.map((d) => d.round));
  const freq = new Map();
  const lastSeen = new Map();
  const pairCount = new Map();
  for (let n = 1; n <= 45; n += 1) {
    freq.set(n, 0);
    lastSeen.set(n, 0);
  }

  const sums = [];
  for (const draw of draws) {
    const nums = draw.numbers;
    sums.push(nums.reduce((a, b) => a + b, 0));
    nums.forEach((n) => {
      freq.set(n, freq.get(n) + 1);
      lastSeen.set(n, draw.round);
    });
    for (let i = 0; i < nums.length; i += 1) {
      for (let j = i + 1; j < nums.length; j += 1) {
        const key = `${nums[i]}-${nums[j]}`;
        pairCount.set(key, (pairCount.get(key) || 0) + 1);
      }
    }
  }

  const gap = new Map();
  for (let n = 1; n <= 45; n += 1) gap.set(n, latestRound - lastSeen.get(n));

  const meanSum = sums.reduce((a, b) => a + b, 0) / sums.length;
  const variance = sums.reduce((a, b) => a + (b - meanSum) ** 2, 0) / sums.length;
  const stdSum = Math.sqrt(variance);

  return { latestRound, freq, gap, pairCount, meanSum, stdSum };
}

// 출현 빈도(자주 나옴)와 미출현 기간(오래 안 나옴, "저조 번호") 두 지표를 정규화해 합산한 가중치.
export function combinedWeight(stats, freqWeight = 0.6, gapWeight = 0.4) {
  const freqVals = [...stats.freq.values()];
  const gapVals = [...stats.gap.values()];
  const maxFreq = Math.max(...freqVals);
  const minFreq = Math.min(...freqVals);
  const maxGap = Math.max(...gapVals);
  const minGap = Math.min(...gapVals);

  const weight = new Map();
  for (let n = 1; n <= 45; n += 1) {
    const fN = maxFreq === minFreq ? 0.5 : (stats.freq.get(n) - minFreq) / (maxFreq - minFreq);
    const gN = maxGap === minGap ? 0.5 : (stats.gap.get(n) - minGap) / (maxGap - minGap);
    weight.set(n, freqWeight * fN + gapWeight * gN + 0.05);
  }
  return weight;
}

export function weightedSample(weightMap, count) {
  const pool = [...weightMap.entries()].map(([num, w]) => ({ num, w }));
  const picked = [];
  for (let i = 0; i < count; i += 1) {
    const total = pool.reduce((sum, p) => sum + p.w, 0);
    let r = Math.random() * total;
    let idx = 0;
    for (; idx < pool.length; idx += 1) {
      r -= pool[idx].w;
      if (r <= 0) break;
    }
    picked.push(pool[Math.min(idx, pool.length - 1)].num);
    pool.splice(Math.min(idx, pool.length - 1), 1);
  }
  return picked.sort((a, b) => a - b);
}

// 실제 당첨 조합들의 전형적인 홀짝/저고구간/합계 분포에서 크게 벗어나는 조합을 걸러낸다.
export function passesBalance(set, stats) {
  const oddCount = set.filter((n) => n % 2 === 1).length;
  const lowCount = set.filter((n) => n <= 22).length;
  const sum = set.reduce((a, b) => a + b, 0);
  if (oddCount < 1 || oddCount > 5) return false;
  if (lowCount < 1 || lowCount > 5) return false;
  if (sum < stats.meanSum - 1.5 * stats.stdSum || sum > stats.meanSum + 1.5 * stats.stdSum) return false;
  return true;
}

// 세트 내 번호쌍들이 역대 얼마나 자주 같이 나왔는지 합산한 점수 (높을수록 "같이 잘 나오던 조합").
export function pairScore(set, pairCount) {
  let score = 0;
  for (let i = 0; i < set.length; i += 1) {
    for (let j = i + 1; j < set.length; j += 1) {
      score += pairCount.get(`${set[i]}-${set[j]}`) || 0;
    }
  }
  return score;
}

// 가중 무작위 + 밸런스 필터로 후보 풀을 만든 뒤, 번호쌍 상관점수가 높은 순으로 정렬해 반환한다.
export function generateRecommendationSets(draws, setCount = 5, poolSize = 10) {
  const stats = computeStats(draws);
  const weightMap = combinedWeight(stats);

  const candidates = [];
  const seen = new Set();
  let guard = 0;
  const maxGuard = poolSize * 60;

  while (candidates.length < poolSize && guard < maxGuard) {
    guard += 1;
    const set = weightedSample(weightMap, 6);
    const key = set.join(',');
    if (seen.has(key) || !passesBalance(set, stats)) continue;
    seen.add(key);
    candidates.push({ set, score: pairScore(set, stats.pairCount) });
  }
  while (candidates.length < poolSize) {
    const set = weightedSample(weightMap, 6);
    candidates.push({ set, score: pairScore(set, stats.pairCount) });
  }

  candidates.sort((a, b) => b.score - a.score);
  const sets = candidates.slice(0, setCount).map((c) => c.set);

  const hotNumbers = [...stats.freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([num, count]) => ({ num, count }));

  const coldNumbers = [...stats.gap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([num, gap]) => ({ num, gap }));

  return { stats, sets, hotNumbers, coldNumbers };
}
