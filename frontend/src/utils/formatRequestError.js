export function formatRequestError(error) {
  if (error?.message) {
    return error.message;
  }

  return 'Server is unavailable. Retrying...';
}
