/**
 * Lenient, international-friendly check for an optional phone number.
 * Shopify (Customer Account API) remains the final validator.
 *
 * - Empty is valid (phone is optional).
 * - Allowed characters: digits, spaces, hyphens, dots, parentheses and one
 *   leading "+".
 * - 7 to 15 digits (15 is the international maximum), at most 30 characters.
 * - Separators are removed before sending, e.g. "+1 (555) 123-4567" is
 *   sent as "+15551234567". No country-specific format is enforced.
 * @param {unknown} input
 * @return {{ok: true; value: string} | {ok: false; error: string}}
 */
export function normalizePhone(input) {
  const value = typeof input === 'string' ? input.trim() : '';
  if (!value) return {ok: true, value: ''};

  const invalid = {
    ok: false,
    error: 'Please enter a valid phone number, e.g. +49 123 456789.',
  };
  if (value.length > 30) return invalid;
  if (!/^\+?[\d\s().-]+$/.test(value)) return invalid;

  const digits = value.replace(/\D/g, '');
  if (digits.length < 7 || digits.length > 15) return invalid;

  return {ok: true, value: `${value.startsWith('+') ? '+' : ''}${digits}`};
}
