import { generateRecommendationSets } from './lotto-logic.js';

const state = { draws: [], recommendation: null };

function ballRange(n) {
  if (n <= 10) return 1;
  if (n <= 20) return 2;
  if (n <= 30) return 3;
  if (n <= 40) return 4;
  return 5;
}

function ball(n, size = '') {
  const span = document.createElement('span');
  span.className = `ball range-${ballRange(n)} ${size}`.trim();
  span.textContent = n;
  return span;
}

function renderRecommendation(sets) {
  const container = document.getElementById('rec-sets');
  container.innerHTML = '';
  sets.forEach((set, i) => {
    const row = document.createElement('div');
    row.className = 'rec-set';
    const label = document.createElement('span');
    label.className = 'set-label';
    label.textContent = `${i + 1}`;
    row.appendChild(label);
    set.forEach((n) => row.appendChild(ball(n)));
    container.appendChild(row);
  });
}

function renderHotNumbers(hotNumbers) {
  const container = document.getElementById('hot-numbers');
  container.innerHTML = '';
  hotNumbers.forEach(({ num, count }) => {
    const item = document.createElement('div');
    item.className = 'hot-item';
    item.appendChild(ball(num, 'small'));
    const c = document.createElement('span');
    c.className = 'count';
    c.textContent = `${count}회`;
    item.appendChild(c);
    container.appendChild(item);
  });
}

function renderColdNumbers(coldNumbers) {
  const container = document.getElementById('cold-numbers');
  container.innerHTML = '';
  coldNumbers.forEach(({ num, gap }) => {
    const item = document.createElement('div');
    item.className = 'hot-item';
    item.appendChild(ball(num, 'small'));
    const c = document.createElement('span');
    c.className = 'count';
    c.textContent = `${gap}회째`;
    item.appendChild(c);
    container.appendChild(item);
  });
}

function renderDrawDetail(draw) {
  const container = document.getElementById('draw-detail');
  if (!draw) {
    container.innerHTML = '<p class="sub">해당 회차 정보를 찾을 수 없습니다.</p>';
    return;
  }
  container.innerHTML = '';
  const title = document.createElement('div');
  title.className = 'round-title';
  title.textContent = `${draw.round}회 (${draw.date} 추첨)`;
  container.appendChild(title);

  const row = document.createElement('div');
  row.className = 'balls-row';
  draw.numbers.forEach((n) => row.appendChild(ball(n)));
  const plus = document.createElement('span');
  plus.className = 'plus';
  plus.textContent = '+';
  row.appendChild(plus);
  row.appendChild(ball(draw.bonus));
  container.appendChild(row);
}

function renderTable(draws) {
  const container = document.getElementById('draw-table');
  const recent = [...draws].sort((a, b) => b.round - a.round).slice(0, 30);
  const table = document.createElement('table');
  table.innerHTML = '<thead><tr><th>회차</th><th>날짜</th><th>번호</th></tr></thead>';
  const tbody = document.createElement('tbody');
  recent.forEach((d) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${d.round}</td><td>${d.date}</td><td class="nums">${d.numbers.join(', ')} + ${d.bonus}</td>`;
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  container.innerHTML = '';
  container.appendChild(table);
}

async function loadData() {
  const status = document.getElementById('status-line');
  try {
    const [draws, recommendation] = await Promise.all([
      fetch('data/draws.json').then((r) => r.json()),
      fetch('data/recommendation.json').then((r) => r.json()),
    ]);
    state.draws = draws;
    state.recommendation = recommendation;

    const latest = draws[draws.length - 1];
    status.textContent = `최신 ${latest.round}회(${latest.date}) 기준 · 총 ${draws.length}회차 데이터`;

    document.getElementById('basis-line').textContent =
      `${recommendation.basedOnRounds}회까지의 출현 빈도·미출현 기간·번호쌍 상관관계·홀짝/구간 밸런스를 반영한 가중 무작위 추천입니다. (실제 당첨 확률을 높여주지는 않습니다)`;

    renderRecommendation(recommendation.sets);
    renderHotNumbers(recommendation.hotNumbers);
    renderColdNumbers(recommendation.coldNumbers);
    renderDrawDetail(latest);
    renderTable(draws);
  } catch (err) {
    status.textContent = '데이터를 불러오지 못했습니다. scripts/fetch-draws.mjs 와 recommend.mjs를 먼저 실행하세요.';
    console.error(err);
  }
}

document.getElementById('reroll-btn').addEventListener('click', () => {
  if (!state.draws.length) return;
  const { sets } = generateRecommendationSets(state.draws, 5);
  renderRecommendation(sets);
});

document.getElementById('search-btn').addEventListener('click', () => {
  const val = Number(document.getElementById('round-input').value);
  const found = state.draws.find((d) => d.round === val);
  renderDrawDetail(found);
});

document.getElementById('latest-btn').addEventListener('click', () => {
  const latest = state.draws[state.draws.length - 1];
  document.getElementById('round-input').value = latest.round;
  renderDrawDetail(latest);
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}

loadData();
