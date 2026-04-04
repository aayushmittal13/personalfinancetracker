function confirmedTransactionClause(alias = 't') {
  return `${alias}.review_status = 'confirmed'`;
}

module.exports = {
  confirmedTransactionClause
};
