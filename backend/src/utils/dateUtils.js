function pad(value) {
  return String(value).padStart(2, '0');
}

function formatDateUTC(date) {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

function getMonthRange(month) {
  const [yearStr, monthStr] = month.split('-');
  const year = Number(yearStr);
  const monthIndex = Number(monthStr) - 1;
  const start = new Date(Date.UTC(year, monthIndex, 1));
  const end = new Date(Date.UTC(year, monthIndex + 1, 0));

  return {
    start: formatDateUTC(start),
    end: formatDateUTC(end)
  };
}

function getPreviousMonth(month) {
  const [yearStr, monthStr] = month.split('-');
  const year = Number(yearStr);
  const monthIndex = Number(monthStr) - 1;
  return formatDateUTC(new Date(Date.UTC(year, monthIndex - 1, 1))).slice(0, 7);
}

function toIsoDateFromEpochMs(epochMs) {
  const parsed = Number(epochMs);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return new Date(parsed).toISOString().slice(0, 10);
}

module.exports = {
  formatDateUTC,
  getMonthRange,
  getPreviousMonth,
  toIsoDateFromEpochMs
};
