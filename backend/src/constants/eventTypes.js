const EVENT_TYPES = Object.freeze(['arrangement', 'task', 'reminder', 'holiday']);
const RECURRENCE_INTERVALS = Object.freeze(['daily', 'weekly', 'monthly', 'yearly']);
const EVENT_STATUSES = Object.freeze([
  'scheduled',
  'canceled',
  'todo',
  'in_progress',
  'done',
]);

const EVENT_STATUSES_BY_TYPE = Object.freeze({
  arrangement: Object.freeze(['scheduled', 'canceled']),
  task: Object.freeze(['todo', 'in_progress', 'done']),
});

module.exports = {
  EVENT_STATUSES,
  EVENT_STATUSES_BY_TYPE,
  EVENT_TYPES,
  RECURRENCE_INTERVALS,
};
