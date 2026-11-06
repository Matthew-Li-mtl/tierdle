// Reads a required setting, and fails with a clear message if it is missing.
export function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}
