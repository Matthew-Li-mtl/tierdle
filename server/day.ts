// Today's date in UTC as "YYYY-MM-DD", so every user is on the same day at the same moment.
export function today(): string {
  return new Date().toISOString().slice(0, 10);
}
