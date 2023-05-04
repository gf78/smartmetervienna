const getDateString = (offset = -1) => {
  offset = Number.parseInt(offset);
  if (Number.isNaN(offset)) {
    offset = -1;
  }
  const date = new Date(new Date().setHours(24 * offset, 0, 0, 0));
  return `${date.getFullYear()}-${("0" + (date.getMonth() + 1)).slice(-2)}-${(
    "0" + date.getDate()
  ).slice(-2)}`;
};

const getDateRange = (days = 0) => {
  days = Number.parseInt(days);
  if (Number.isNaN(days) || days < 1) {
    days = 0;
  }
  days = Math.min(days, 365 * 3 - 1);
  const to = getDateString(-1);
  const from = getDateString(-days);
  return { from, to, days };
};

module.exports = { getDateRange, getDateString };
