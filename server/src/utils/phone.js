export function normalizePhone(raw, countryCode = '52') {
  if (!raw) return '';
  // Remove all non-digits
  let digits = String(raw).replace(/\D/g, '');

  // If starts with 00, drop leading 00 (e.g., 0052... -> 52...)
  if (digits.startsWith('00')) digits = digits.slice(2);

  // If already starts with the country code, keep as is
  if (digits.startsWith(countryCode)) {
    // Special handling for MX: WhatsApp JIDs commonly use 521XXXXXXXXXX
    if (countryCode === '52' && digits.length === 12 && !digits.startsWith('521')) {
      return '521' + digits.slice(2);
    }
    return digits;
  }

  // Special case: some regions use an extra '1' (historical MX 521). If already 521..., keep it
  if (countryCode === '52' && digits.startsWith('521')) return digits;

  // If it's a local 10-digit number, prepend country code
  if (digits.length === 10) {
    if (countryCode === '52') return '521' + digits; // MX: prefer 521 for WA
    return countryCode + digits;
  }

  // If it's 11 digits and likely mobile with leading '1' (e.g., US), return as is
  if (digits.length === 11) return digits;

  // Fallback: if empty after cleaning, return ''
  return digits;
}
