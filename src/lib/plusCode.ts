/**
 * Minimal Open Location Code (Google Plus Code) decoder.
 * Supports full codes ("7MJFVGX2+QJQ") and short codes with city name
 * ("VGX2+QJQ Khulna").
 *
 * Algorithm: https://github.com/google/open-location-code
 *
 * "VGX2+QJQ Khulna" → expands to "7MJFVGX2+QJQ" → decodes to ~22.8994°N, 89.502°E (KUET CSE)
 */

const ALPHABET = '23456789CFGHJMPQRVWX'; // 20 chars, base-20 encoding
const PAIR_RESOLUTIONS = [20.0, 1.0, 0.05, 0.0025]; // ° per char increment at each pair level
const GRID_ROWS = 5;
const GRID_COLS = 4;

/** Known city centres used to expand short Plus Codes. */
const CITY_REFS: Record<string, readonly [number, number]> = {
  khulna:     [22.8456,  89.5403],
  dhaka:      [23.8103,  90.4125],
  chittagong: [22.3569,  91.7832],
  sylhet:     [24.8949,  91.8687],
  rajshahi:   [24.3636,  88.6241],
  comilla:    [23.4607,  91.1809],
  mymensingh: [24.7471,  90.4203],
};

function charIdx(ch: string): number {
  return ALPHABET.indexOf(ch.toUpperCase());
}

/**
 * Expand a short Plus Code (separator at position < 8) to a full 8-char prefix
 * using a reference lat/lng.
 */
function expandShortCode(shortCode: string, refLat: number, refLng: number): string {
  const sep = shortCode.indexOf('+');
  if (sep < 0 || sep >= 8) return shortCode; // already full or invalid

  const missingLen = 8 - sep; // number of chars to prepend
  const latNorm = refLat + 90;
  const lngNorm = refLng + 180;

  let prefix = '';
  for (let i = 0; i < missingLen; i += 2) {
    const res = PAIR_RESOLUTIONS[i / 2];
    prefix += ALPHABET[Math.floor(latNorm / res) % 20];
    prefix += ALPHABET[Math.floor(lngNorm / res) % 20];
  }

  return prefix + shortCode;
}

/** Decode a full Plus Code (separator at position 8) to a lat/lng centre. */
function decodeFullCode(code: string): { lat: number; lng: number } | null {
  // Strip the '+' then work with the raw digit string
  const stripped = code.replace('+', '').toUpperCase();
  if (stripped.length < 10) return null; // need at least 4 pairs + 2 grid chars

  let latLo = -90.0;
  let lngLo = -180.0;

  // Process first 4 pairs (chars 0-7 in stripped code)
  for (let i = 0; i < 8; i += 2) {
    const li = charIdx(stripped[i]);
    const gi = charIdx(stripped[i + 1]);
    if (li < 0 || gi < 0) return null;
    const res = PAIR_RESOLUTIONS[i / 2];
    latLo += li * res;
    lngLo += gi * res;
  }

  // Process precision chars after '+' (starting at index 8 in stripped code)
  // Each char encodes a GRID_ROWS×GRID_COLS cell within the current resolution.
  let latStep = PAIR_RESOLUTIONS[3] / GRID_ROWS; // 0.0025/5 = 0.0005
  let lngStep = PAIR_RESOLUTIONS[3] / GRID_COLS; // 0.0025/4 = 0.000625

  for (let i = 8; i < stripped.length; i++) {
    const digit = charIdx(stripped[i]);
    if (digit < 0) return null;
    latLo += Math.floor(digit / GRID_COLS) * latStep;
    lngLo += (digit % GRID_COLS) * lngStep;
    // Shrink resolution for next character
    latStep /= GRID_ROWS;
    lngStep /= GRID_COLS;
  }

  // Return the centre of the smallest decoded cell
  return {
    lat: +(latLo + latStep * GRID_ROWS / 2).toFixed(6),
    lng: +(lngLo + lngStep * GRID_COLS / 2).toFixed(6),
  };
}

/**
 * Decode a Plus Code string to {lat, lng}.
 *
 * Accepts full codes ("7MJFVGX2+QJQ") or short codes with an optional city
 * reference ("VGX2+QJQ Khulna").  When a city is not recognised, defaults to
 * Khulna (KUET campus area).
 *
 * Returns null for invalid/empty input.
 */
export function decodePlusCode(input: string): { lat: number; lng: number } | null {
  if (!input || !input.trim()) return null;

  const parts = input.trim().split(/\s+/);
  const plusCode = parts[0].toUpperCase();
  const cityName = parts.length > 1 ? parts.slice(1).join(' ').toLowerCase() : '';

  const sep = plusCode.indexOf('+');
  if (sep < 0) return null;

  let fullCode = plusCode;

  if (sep < 8) {
    // Short code: resolve city reference, then expand
    const ref = cityName && cityName in CITY_REFS
      ? CITY_REFS[cityName]
      : CITY_REFS['khulna']; // default: Khulna / KUET area
    fullCode = expandShortCode(plusCode, ref[0], ref[1]);
  }

  return decodeFullCode(fullCode);
}
