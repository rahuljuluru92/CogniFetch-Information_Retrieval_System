/** Maps an ApiError's validation details to { field: message } for inline form errors. */
export function fieldErrors(error) {
  const result = {};
  for (const detail of error?.details ?? []) {
    if (detail.field && !result[detail.field]) result[detail.field] = detail.message;
  }
  return result;
}
