import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const match = html.match(/\/\/ AUTO_ORGANIZER_CORE_START([\s\S]*?)\/\/ AUTO_ORGANIZER_CORE_END/);

assert.ok(match, 'auto organizer core block must exist');

const context = {};
vm.runInNewContext(`${match[1]}\nthis.__organizer = MindSpaceOrganizer;`, context);
const organizer = context.__organizer;
const plain = value => JSON.parse(JSON.stringify(value));

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

test('full topic name classifies an untagged card', () => {
  const result = organizer.classifyIdeas([
    { id: '1', text: '今天要完成工作总结', tags: [], status: 'raw' }
  ], topics);

  assert.equal(result.assignments['1'], 'work');
});

test('ambiguous equal scores remain unsorted', () => {
  const result = organizer.classifyIdeas([
    { id: '1', text: '健康工作都要兼顾', tags: [], status: 'raw' }
  ], topics);

  assert.equal(result.assignments['1'], null);
});

test('learned keywords classify an untagged card', () => {
  const ideas = [
    { id: 'seed', text: '跑步 训练 周末 计划', tags: ['健康'], status: 'sorted' },
    { id: 'new', text: '周末跑步训练计划', tags: [], status: 'raw' }
  ];

  assert.equal(organizer.classifyIdeas(ideas, topics).assignments.new, 'health');
});

test('archived cards do not train or receive assignments', () => {
  const ideas = [
    { id: 'seed', text: '预算发票报销', tags: ['工作'], status: 'archived' },
    { id: 'new', text: '整理发票', tags: [], status: 'raw' }
  ];
  const result = organizer.classifyIdeas(ideas, topics);

  assert.equal(result.assignments.seed, undefined);
  assert.equal(result.assignments.new, null);
});

test('topic ordering uses card count then original order', () => {
  const counts = { health: 1, work: 3 };

  assert.deepEqual(
    plain(organizer.orderTopics(topics, counts).map(topic => topic.id)),
    ['work', 'health']
  );
  assert.deepEqual(
    plain(organizer.orderTopics(topics, { health: 2, work: 2 }).map(topic => topic.id)),
    ['health', 'work']
  );
});

test('applyAssignment replaces topic tags and keeps non-topic tags', () => {
  const card = { tags: ['健康', '重要'], status: 'sorted' };

  organizer.applyAssignment(card, topics, 'work');

  assert.deepEqual(plain(card.tags), ['工作', '重要']);
  assert.equal(card.status, 'sorted');
});

test('applyAssignment leaves uncertain cards in unsorted with non-topic tags', () => {
  const card = { tags: ['健康', '重要'], status: 'sorted' };

  organizer.applyAssignment(card, topics, null);

  assert.deepEqual(plain(card.tags), ['重要']);
  assert.equal(card.status, 'raw');
});

test('radial layout starts above center and stays in canvas bounds', () => {
  const center = { x: 7640, y: 7800 };
  const topicList = Array.from({ length: 12 }, (_, index) => ({
    id: String(index),
    name: `T${index}`
  }));
  const positions = organizer.layoutTopics(topicList, center, {
    canvasWidth: 16000,
    canvasHeight: 16000,
    zoneWidth: 720,
    zoneHeight: 400,
    gap: 120
  });

  assert.ok(positions['0'].y < center.y);
  for (const position of Object.values(positions)) {
    assert.ok(position.x >= 0 && position.x <= 15280);
    assert.ok(position.y >= 0 && position.y <= 15600);
  }

  const boxes = Object.values(positions).map(position => ({
    left: position.x,
    top: position.y,
    right: position.x + 720,
    bottom: position.y + 400
  }));
  for (let left = 0; left < boxes.length; left += 1) {
    for (let right = left + 1; right < boxes.length; right += 1) {
      const overlaps = !(boxes[left].right <= boxes[right].left ||
        boxes[left].left >= boxes[right].right ||
        boxes[left].bottom <= boxes[right].top ||
        boxes[left].top >= boxes[right].bottom);
      assert.equal(overlaps, false, `zones ${left} and ${right} must not overlap`);
    }
  }
});

test('one topic is placed directly above the unsorted zone', () => {
  const center = { x: 7640, y: 7800 };
  const positions = organizer.layoutTopics([topics[0]], center, {
    canvasWidth: 16000,
    canvasHeight: 16000,
    zoneWidth: 720,
    zoneHeight: 400,
    gap: 120
  });

  assert.equal(positions.health.x, center.x);
  assert.ok(positions.health.y < center.y);
});

test('snapshot restore returns state metadata and viewport to previous values', () => {
  const state = {
    ideas: [{
      id: '1',
      tags: [],
      status: 'raw',
      position: { x: 1, y: 2 }
    }],
    topics: [{
      id: 'health',
      name: '健康',
      position: { x: 3, y: 4 }
    }],
    meta: { version: 1 }
  };
  const view = { mode: 'all', scale: 1, tx: 5, ty: 6 };
  const snapshot = organizer.createSnapshot(state, view);

  state.ideas[0].position.x = 99;
  state.topics[0].position.x = 99;
  state.meta.unsortedPosition = { x: 8000, y: 8000 };
  view.scale = 0.2;
  organizer.restoreSnapshot(state, view, snapshot);

  assert.equal(state.ideas[0].position.x, 1);
  assert.equal(state.topics[0].position.x, 3);
  assert.equal(state.meta.unsortedPosition, undefined);
  assert.equal(view.scale, 1);
  assert.equal(view.tx, 5);
});
