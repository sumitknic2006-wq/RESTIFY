export function getElapsedSeconds(session, synchronizedAt, now = Date.now()) {
  if (!session || !Number.isFinite(session.durationSeconds)) return 0;
  if (session.status !== 'active' || !Number.isFinite(synchronizedAt)) {
    return Math.max(0, session.durationSeconds);
  }
  return Math.max(
    0,
    session.durationSeconds + Math.floor(Math.max(0, now - synchronizedAt) / 1000)
  );
}

export function getRemainingSeconds(session, synchronizedAt, now = Date.now()) {
  const limitSeconds = (session?.ruleSnapshot?.timeLimit || 0) * 60;
  return Math.max(0, limitSeconds - getElapsedSeconds(session, synchronizedAt, now));
}

export function getRestRemainingSeconds(restEndsAt, now = Date.now()) {
  const endTime = new Date(restEndsAt || 0).getTime();
  if (!Number.isFinite(endTime) || endTime <= 0) return 0;
  return Math.max(0, Math.ceil((endTime - now) / 1000));
}

export function formatClock(totalSeconds) {
  const seconds = Math.max(0, Math.floor(totalSeconds || 0));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  return [hours, minutes, remainder].map((part) => String(part).padStart(2, '0')).join(':');
}
