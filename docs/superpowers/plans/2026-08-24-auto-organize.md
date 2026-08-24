# Mind Space Auto Organize Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add deterministic one-click card classification and radial topic layout around the centered unsorted zone, with one-step undo.

**Architecture:** Keep production code in `index.html`. Add a delimited pure-function organizer block that can run in both the browser and a Node `vm` test harness; keep DOM access, state mutation, persistence, and viewport fitting in the existing application layer.

**Tech Stack:** HTML, CSS, browser JavaScript, Node.js built-in `node:test`, `assert`, `fs`, and `vm`; Vercel static hosting.

---

## File Structure

- Modify: `index.html` - organizer core, application integration, undo branch, header button, responsive styling, and event binding.
- Create: `tests/auto-organize.test.mjs` - zero-dependency unit tests that extract and evaluate the pure organizer block.
- Modify: `README.md` - document automatic organization and its offline behavior.

### Task 1: Add Failing Organizer Core Tests

**Files:**
- Create: `tests/auto-organize.test.mjs`
- Test: `tests/auto-organize.test.mjs`

- [ ] **Step 1: Write the test harness and classification tests**

The test harness reads `index.html`, extracts code between `// AUTO_ORGANIZER_CORE_START` and `// AUTO_ORGANIZER_CORE_END`, evaluates it in a `vm` context, and exposes `MindSpaceOrganizer`.

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const match = html.match(/\/\/ AUTO_ORGANIZER_CORE_START([\s\S]*?)\/\/ AUTO_ORGANIZER_CORE_END/);
assert.ok(match, 'auto organizer core block must exist');
const context = { MindSpaceOrganizer: undefined };
vm.runInNewContext(`${match[1]}\nthis.__result = MindSpaceOrganizer;`, context);
const organizer = context.__result;

const topics = [
  { id: 'health', name: '健康' },
  { id: 'work', name: '工作' }
];

test('existing exact topic tag outranks text matches', () => {
  const result = organizer.classifyIdeas([
    { id: '1', text: '今天处理工作邮件', tags: ['健康'], status: 'sorted' }
  ], topics);
  assert.equal(result.assignments['1'], 'health');
});

test('ambiguous equal scores remain unsorted', () => {
  const result = organizer.classifyIdeas([
    { id: '1', text: '健康工作都要兼顾', tags: [], status: 'raw' }
  ], topics);
  assert.equal(result.assignments['1'], null);
});

test('learned keywords classify an untagged card', () => {
  const ideas = [
    { id: 'seed', text: '跑步训练计划', tags: ['健康'], status: 'sorted' },
    { id: 'new', text: '周末继续跑步', tags: [], status: 'raw' }
  ];
  assert.equal(organizer.classifyIdeas(ideas, topics).assignments.new, 'health');
});
```

- [ ] **Step 2: Add layout and tag-preservation tests**

```js
test('radial layout starts above center and stays in canvas bounds', () => {
  const center = { x: 7640, y: 7800 };
  const topicList = Array.from({ length: 12 }, (_, index) => ({ id: String(index), name: `T${index}` }));
  const positions = organizer.layoutTopics(topicList, center, {
    canvasWidth: 16000, canvasHeight: 16000, zoneWidth: 720, zoneHeight: 400, gap: 120
  });
  assert.ok(positions['0'].y < center.y);
  for (const position of Object.values(positions)) {
    assert.ok(position.x >= 0 && position.x <= 15280);
    assert.ok(position.y >= 0 && position.y <= 15600);
  }
});

test('topic ordering uses card count then original order', () => {
  const counts = { health: 1, work: 3 };
  assert.deepEqual(
    organizer.orderTopics(topics, counts).map(topic => topic.id),
    ['work', 'health']
  );
});

test('applyAssignment keeps non-topic tags', () => {
  const card = { tags: ['健康', '重要'], status: 'sorted' };
  organizer.applyAssignment(card, topics, 'work');
  assert.deepEqual(card.tags, ['工作', '重要']);
});
```

- [ ] **Step 3: Run tests and verify RED**

Run: `node --test tests/auto-organize.test.mjs`

Expected: FAIL with `auto organizer core block must exist` because production code has not been added.

- [ ] **Step 4: Commit the failing tests**

```bash
git add tests/auto-organize.test.mjs
git commit -m "test: define automatic organization behavior"
```

### Task 2: Implement The Pure Organizer Core

**Files:**
- Modify: `index.html` near the constants and state declarations
- Test: `tests/auto-organize.test.mjs`

- [ ] **Step 1: Add the delimited pure-function block**

Create `MindSpaceOrganizer` with these public methods:

```js
// AUTO_ORGANIZER_CORE_START
const MindSpaceOrganizer = (() => {
  const STOP_WORDS = new Set(['的', '了', '和', '与', '是', '在', 'to', 'the', 'a', 'an', 'and', 'or', 'for']);

  function normalizeText(value) {
    return String(value || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  }

  function tokenize(value) {
    const tokens = new Set();
    const runs = normalizeText(value).match(/[\p{Script=Han}]+|[a-z0-9]+/gu) || [];
    for (const run of runs) {
      if (/^[\p{Script=Han}]+$/u.test(run)) {
        if (run.length > 1 && !STOP_WORDS.has(run)) tokens.add(run);
        for (let index = 0; index < run.length - 1; index += 1) {
          const pair = run.slice(index, index + 2);
          if (!STOP_WORDS.has(pair)) tokens.add(pair);
        }
      } else if (run.length > 1 && !STOP_WORDS.has(run)) {
        tokens.add(run);
      }
    }
    return [...tokens];
  }

  function buildTopicKeywords(ideas, topics) {
    const keywords = Object.fromEntries(topics.map(topic => [topic.id, new Set()]));
    for (const idea of ideas.filter(card => card.status !== 'archived')) {
      for (const topic of topics) {
        if (!(idea.tags || []).includes(topic.name)) continue;
        const topicTokens = new Set(tokenize(topic.name));
        for (const token of tokenize(idea.text)) {
          if (!topicTokens.has(token)) keywords[topic.id].add(token);
        }
      }
    }
    return keywords;
  }

  function classifyIdeas(ideas, topics) {
    const activeIdeas = ideas.filter(card => card.status !== 'archived');
    const keywords = buildTopicKeywords(activeIdeas, topics);
    const assignments = {};
    let assignedCount = 0;
    for (const card of activeIdeas) {
      const text = normalizeText(card.text);
      const cardTokens = new Set(tokenize(card.text));
      const scores = topics.map(topic => {
        let score = (card.tags || []).includes(topic.name) ? 100 : 0;
        const topicText = normalizeText(topic.name);
        if (topicText && text.includes(topicText)) score += 40;
        for (const token of tokenize(topic.name)) if (cardTokens.has(token)) score += 10;
        let learnedHits = 0;
        for (const keyword of keywords[topic.id]) if (cardTokens.has(keyword)) learnedHits += 1;
        score += Math.min(30, learnedHits * 3);
        return { topicId: topic.id, score };
      });
      scores.sort((left, right) => right.score - left.score);
      const uniqueWinner = scores.length > 0 && scores[0].score >= 10 &&
        (scores.length === 1 || scores[0].score > scores[1].score);
      assignments[card.id] = uniqueWinner ? scores[0].topicId : null;
      if (uniqueWinner) assignedCount += 1;
    }
    return { assignments, assignedCount, unsortedCount: activeIdeas.length - assignedCount };
  }

  function orderTopics(topics, counts) {
    return topics.map((topic, index) => ({ topic, index }))
      .sort((left, right) => (counts[right.topic.id] || 0) - (counts[left.topic.id] || 0) || left.index - right.index)
      .map(item => item.topic);
  }

  function layoutTopics(topics, center, options) {
    const { canvasWidth, canvasHeight, zoneWidth, zoneHeight, gap } = options;
    const positions = {};
    const centerX = center.x + zoneWidth / 2;
    const centerY = center.y + zoneHeight / 2;
    let offset = 0;
    let ring = 0;
    while (offset < topics.length) {
      const radius = Math.max(zoneWidth + gap, ((zoneWidth + gap) * 8) / (Math.PI * 2)) + ring * (zoneHeight + gap);
      const capacity = Math.max(8, Math.floor((Math.PI * 2 * radius) / (zoneWidth + gap)));
      const ringTopics = topics.slice(offset, offset + capacity);
      ringTopics.forEach((topic, index) => {
        const angle = -Math.PI / 2 + (Math.PI * 2 * index) / ringTopics.length;
        positions[topic.id] = {
          x: Math.max(0, Math.min(canvasWidth - zoneWidth, Math.round(centerX + Math.cos(angle) * radius - zoneWidth / 2))),
          y: Math.max(0, Math.min(canvasHeight - zoneHeight, Math.round(centerY + Math.sin(angle) * radius - zoneHeight / 2)))
        };
      });
      offset += ringTopics.length;
      ring += 1;
    }
    return positions;
  }

  function applyAssignment(card, topics, topicId) {
    const topicNames = new Set(topics.map(topic => topic.name));
    const extraTags = (card.tags || []).filter(tag => !topicNames.has(tag));
    const topic = topics.find(item => item.id === topicId);
    card.tags = topic ? [topic.name, ...extraTags] : extraTags;
    card.status = topic ? 'sorted' : 'raw';
    return card;
  }

  return { normalizeText, tokenize, buildTopicKeywords, classifyIdeas, orderTopics, layoutTopics, applyAssignment };
})();
// AUTO_ORGANIZER_CORE_END
```

Scoring must exactly follow the approved spec: exact topic tag 100, complete topic-name text match 40, topic-name token match 10 each, learned keyword match 3 each, unique highest score at least 10.

- [ ] **Step 2: Run tests and verify GREEN**

Run: `node --test tests/auto-organize.test.mjs`

Expected: all classification, ordering, tag, and layout tests pass.

- [ ] **Step 3: Refactor only inside the organizer block**

Remove duplicated token-set creation and keep all public results JSON-compatible so the `vm` test harness and browser receive the same values.

- [ ] **Step 4: Run tests after refactor**

Run: `node --test tests/auto-organize.test.mjs`

Expected: PASS with zero failures.

- [ ] **Step 5: Commit the organizer core**

```bash
git add index.html tests/auto-organize.test.mjs
git commit -m "feat: add deterministic organizer core"
```

### Task 3: Integrate State Mutation, Radial Placement, And Undo

**Files:**
- Modify: `index.html` in zone helpers, undo handling, viewport helpers, and event bindings
- Test: `tests/auto-organize.test.mjs`

- [ ] **Step 1: Add a failing snapshot-restoration test**

Write a test that requires pure helpers `createSnapshot(state, view)` and `restoreSnapshot(targetState, targetView, snapshot)` and checks exact restoration of ideas, topic positions, metadata, and viewport values.

```js
test('snapshot restore returns cards topics and viewport to their previous values', () => {
  const state = { ideas: [{ id: '1', tags: [], status: 'raw', position: { x: 1, y: 2 } }], topics: [{ id: 't', position: { x: 3, y: 4 } }] };
  const view = { mode: 'all', scale: 1, tx: 5, ty: 6 };
  const snapshot = organizer.createSnapshot(state, view);
  state.ideas[0].position.x = 99;
  state.topics[0].position.x = 99;
  view.scale = 0.2;
  organizer.restoreSnapshot(state, view, snapshot);
  assert.equal(state.ideas[0].position.x, 1);
  assert.equal(state.topics[0].position.x, 3);
  assert.equal(view.scale, 1);
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test --test-name-pattern="snapshot restore" tests/auto-organize.test.mjs`

Expected: FAIL because `createSnapshot` is not defined.

- [ ] **Step 3: Implement snapshot helpers and application orchestration**

Add these helpers to the organizer block and its returned API:

```js
function createSnapshot(state, view) {
  return JSON.parse(JSON.stringify({ state, view }));
}

function restoreSnapshot(targetState, targetView, snapshot) {
  const restored = JSON.parse(JSON.stringify(snapshot));
  targetState.ideas = restored.state.ideas;
  targetState.topics = restored.state.topics;
  targetState.meta = restored.state.meta;
  Object.assign(targetView, restored.view);
}
```

Add `autoOrganize()` in the application layer. It must:

```js
function autoOrganize() {
  const activeIdeas = state.ideas.filter(card => card.status !== 'archived');
  if (state.topics.length === 0) {
    showToast('请先创建主题，再进行自动整理');
    centerViewOnUnsorted();
    return;
  }
  const snapshot = MindSpaceOrganizer.createSnapshot(state, view);
  const result = MindSpaceOrganizer.classifyIdeas(activeIdeas, state.topics);
  const counts = Object.fromEntries(state.topics.map(topic => [topic.id, 0]));

  for (const card of activeIdeas) {
    const topicId = result.assignments[card.id];
    MindSpaceOrganizer.applyAssignment(card, state.topics, topicId);
    if (topicId) counts[topicId] += 1;
  }

  const ordered = MindSpaceOrganizer.orderTopics(state.topics, counts);
  state.meta.unsortedPosition = { x: (16000 - ZONE_W) / 2, y: (16000 - ZONE_MIN_H) / 2 };
  const center = state.meta.unsortedPosition;
  const positions = MindSpaceOrganizer.layoutTopics(ordered, center, { canvasWidth: 16000, canvasHeight: 16000, zoneWidth: ZONE_W, zoneHeight: ZONE_MIN_H, gap: 120 });
  for (const topic of state.topics) topic.position = positions[topic.id];
  repositionActiveCardsByZone();
  pushUndo({ type: 'autoOrganize', snapshot });
  saveState();
  render();
  fitViewToZonesAndCards();
  showToast(`已整理 ${result.assignedCount} 条，${result.unsortedCount} 条保留未分类（可撤销）`);
}
```

Persist the automatic center by checking metadata first in `getUnsortedZonePosition()`:

```js
function getUnsortedZonePosition() {
  if (state.meta && state.meta.unsortedPosition) {
    return { ...state.meta.unsortedPosition };
  }
  const cx = Math.round((typeof window !== 'undefined' ? window.innerWidth : 1280) / 2 - ZONE_W / 2);
  const cy = Math.round((typeof window !== 'undefined' ? window.innerHeight : 800) / 2 - ZONE_MIN_H / 2);
  return { x: cx, y: cy };
}
```

Place cards one at a time using the existing collision-aware helper:

```js
function repositionActiveCardsByZone() {
  const activeIdeas = state.ideas.filter(card => card.status !== 'archived');
  for (const card of activeIdeas) card.position = { x: -100000, y: -100000 };
  for (const card of activeIdeas) card.position = findSpotInZone(getZoneForCard(card), card.id);
}
```

Fit both zones and cards, including an empty unsorted zone:

```js
function fitViewToZonesAndCards() {
  const bounds = [];
  for (const zone of getAllZones()) {
    bounds.push({ x: zone.position.x, y: zone.position.y, width: ZONE_W, height: computeZoneHeight(zone) });
  }
  for (const card of state.ideas.filter(item => item.status !== 'archived')) {
    bounds.push({ x: card.position.x, y: card.position.y, width: CARD_W, height: CARD_H });
  }
  const minX = Math.min(...bounds.map(item => item.x));
  const minY = Math.min(...bounds.map(item => item.y));
  const maxX = Math.max(...bounds.map(item => item.x + item.width));
  const maxY = Math.max(...bounds.map(item => item.y + item.height));
  const viewport = document.getElementById('canvas-wrap');
  const padding = 80;
  view.scale = Math.max(0.1, Math.min(1, Math.min(viewport.clientWidth / (maxX - minX + padding * 2), viewport.clientHeight / (maxY - minY + padding * 2))));
  view.tx = viewport.clientWidth / 2 - ((minX + maxX) / 2) * view.scale;
  view.ty = viewport.clientHeight / 2 - ((minY + maxY) / 2) * view.scale;
  updateCanvasTransform();
}
```

- [ ] **Step 4: Add the `autoOrganize` undo branch**

```js
} else if (action.type === 'autoOrganize') {
  MindSpaceOrganizer.restoreSnapshot(state, view, action.snapshot);
```

After `render()`, call `updateCanvasTransform()` so restored viewport values remain active.

- [ ] **Step 5: Run all unit tests**

Run: `node --test tests/auto-organize.test.mjs`

Expected: PASS with zero failures.

- [ ] **Step 6: Commit integration**

```bash
git add index.html tests/auto-organize.test.mjs
git commit -m "feat: organize cards and topics with undo"
```

### Task 4: Add The Control, Responsive Behavior, Documentation, And Verification

**Files:**
- Modify: `index.html` header HTML, header CSS, and event bindings
- Modify: `README.md`
- Test: `tests/auto-organize.test.mjs`

- [ ] **Step 1: Add the header control**

Place the primary command before `管理主题`:

```html
<button class="tool primary" id="btn-auto-organize" title="按现有主题自动整理卡片和色区">自动整理</button>
```

Bind it once after the topic-management bindings:

```js
document.getElementById('btn-auto-organize').addEventListener('click', autoOrganize);
```

- [ ] **Step 2: Keep the header usable on narrow screens**

Add a horizontal-scroll fallback and stable button sizing without changing the desktop layout:

```css
#header { overflow-x: auto; scrollbar-width: none; }
#header::-webkit-scrollbar { display: none; }
#header button, #view-tabs { flex-shrink: 0; }
```

- [ ] **Step 3: Document the feature**

Add a README feature bullet explaining that `自动整理` uses existing topic names, tags, and learned local keywords; it creates no topics, sends no data to a server, and can be undone once with `Ctrl/Cmd+Z`.

- [ ] **Step 4: Run static and unit verification**

Run:

```bash
node --test tests/auto-organize.test.mjs
git diff --check
```

Expected: tests pass and `git diff --check` prints no errors.

- [ ] **Step 5: Run browser verification**

Serve the repository with `python3 -m http.server 4173`, then verify at desktop `1440x900` and mobile `390x844`:

- Create existing topics `健康` and `工作`.
- Create seeded tagged cards and untagged matching cards.
- Click `自动整理`.
- Confirm the unsorted zone is centered and topic zones surround it.
- Confirm matching cards move to the expected zones and unmatched cards remain unsorted.
- Confirm the toast counts agree with visible cards.
- Press `Ctrl/Cmd+Z` and confirm all positions and tags restore.
- Reload and confirm the organized state persists when not undone.
- Confirm there are no console errors and the header remains operable on mobile.

- [ ] **Step 6: Commit the UI and documentation**

```bash
git add index.html README.md
git commit -m "feat: expose automatic organization control"
```

- [ ] **Step 7: Push and deploy**

Run:

```bash
git push origin main
npx vercel --prod --yes
```

Expected: GitHub accepts the commits and Vercel reports a production alias.

- [ ] **Step 8: Verify production**

Run a fresh HTTP request against the production alias and confirm status 200, title `Mind Space`, and presence of `id="btn-auto-organize"` in the returned HTML.
