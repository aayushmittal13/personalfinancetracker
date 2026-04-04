function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function getReviewMetadata({ source, categoryName, accountId, parsed }) {
  if (source !== 'gmail') {
    return {
      status: 'confirmed',
      reason: null,
      confidence: 1
    };
  }

  let confidence = 0.45;
  const reasons = [];

  if (accountId) confidence += 0.2;
  else reasons.push('Needs account review');

  if (categoryName && categoryName !== 'Others') confidence += 0.2;
  else reasons.push('Needs category review');

  if (parsed?.date) confidence += 0.1;
  if (parsed?.description) confidence += 0.05;

  return {
    status: 'pending',
    reason: reasons[0] || 'Gmail import pending confirmation',
    confidence: clamp(Number(confidence.toFixed(2)), 0.1, 0.95)
  };
}

module.exports = {
  getReviewMetadata
};
