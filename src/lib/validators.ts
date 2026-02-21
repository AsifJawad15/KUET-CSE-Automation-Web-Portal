// ==========================================
// Reusable Validation Functions
// Single Responsibility: Pure validation logic only
// Open/Closed: Add new validators without changing existing ones
// Interface Segregation: Each validator is independent
// ==========================================

/**
 * Validation result — consistent shape for all validators.
 */
export interface ValidationResult {
  valid: boolean;
  error?: string;
}

const VALID: ValidationResult = { valid: true };

// ── Primitive Validators ───────────────────────────────

export function requireField(value: unknown, fieldName: string): ValidationResult {
  if (value === undefined || value === null || value === '') {
    return { valid: false, error: `${fieldName} is required` };
  }
  return VALID;
}

export function requireFields(fields: Record<string, unknown>): ValidationResult {
  const missing = Object.entries(fields)
    .filter(([, value]) => value === undefined || value === null || value === '')
    .map(([key]) => key);

  if (missing.length > 0) {
    return { valid: false, error: `Required fields: ${missing.join(', ')}` };
  }
  return VALID;
}

// ── String Validators ──────────────────────────────────

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function validateEmail(email: string): ValidationResult {
  if (!EMAIL_REGEX.test(email)) {
    return { valid: false, error: 'Invalid email format' };
  }
  return VALID;
}

export function validateUUID(value: string, fieldName = 'ID'): ValidationResult {
  if (!UUID_REGEX.test(value)) {
    return { valid: false, error: `${fieldName} must be a valid UUID` };
  }
  return VALID;
}

export function validateUppercase(value: string, fieldName: string): ValidationResult {
  if (value !== value.toUpperCase()) {
    return { valid: false, error: `${fieldName} must be uppercase (e.g., CSE 3201)` };
  }
  return VALID;
}

// ── Numeric Validators ─────────────────────────────────

export function validatePositiveNumber(value: number, fieldName: string): ValidationResult {
  if (Number(value) <= 0) {
    return { valid: false, error: `${fieldName} must be greater than 0` };
  }
  return VALID;
}

// ── Domain Validators ──────────────────────────────────

const VALID_TERMS = ['1-1', '1-2', '2-1', '2-2', '3-1', '3-2', '4-1', '4-2'] as const;

export type ValidTerm = (typeof VALID_TERMS)[number];

export function validateTerm(term: string): ValidationResult {
  if (!VALID_TERMS.includes(term as ValidTerm)) {
    return { valid: false, error: `Invalid term "${term}". Must be one of: ${VALID_TERMS.join(', ')}` };
  }
  return VALID;
}

export function isValidTerm(term: string): term is ValidTerm {
  return VALID_TERMS.includes(term as ValidTerm);
}

export function getValidTerms(): readonly string[] {
  return VALID_TERMS;
}

// ── Composite Validator ────────────────────────────────

/**
 * Run multiple validators in sequence; return the first error found.
 * Usage: `const err = runValidations(v1, v2, v3); if (err) return badRequest(err);`
 */
export function runValidations(...results: ValidationResult[]): string | null {
  for (const result of results) {
    if (!result.valid) return result.error ?? 'Validation failed';
  }
  return null;
}
