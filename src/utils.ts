/** Default maximum input length (10,000 characters). */
export const MAX_INPUT_LENGTH = 10_000;

/**
 * Validates and sanitizes text input.
 * Handles null/undefined, non-string types, and length truncation.
 *
 * @param text - The input to validate.
 * @param maxLength - Maximum allowed length before truncation.
 * @returns The sanitized string.
 */
export function validateInput(text: string, maxLength: number): string {
  if (text == null) return "";
  if (typeof text !== "string") return String(text);
  if (text.length > maxLength) return text.slice(0, maxLength);
  return text;
}
