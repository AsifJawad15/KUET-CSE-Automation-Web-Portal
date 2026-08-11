/**
 * Password Utilities for Authentication
 * Handles password hashing, generation, and validation
 */

import bcrypt from 'bcryptjs';
import { randomInt, randomBytes } from 'crypto';

/**
 * Hash a plain text password using bcrypt
 * @param password - Plain text password
 * @returns Promise with bcrypt hash
 */
export async function hashPassword(password: string): Promise<string> {
  const saltRounds = 10;
  return await bcrypt.hash(password, saltRounds);
}

/**
 * Compare a plain text password with a bcrypt hash
 * @param password - Plain text password
 * @param hash - Bcrypt hash to compare against
 * @returns Promise with boolean result
 */
export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return await bcrypt.compare(password, hash);
}

/**
 * Generate a random 6-digit password for teachers using crypto.randomInt
 * @returns 6-digit numeric string (e.g., "123456")
 */
export function generateTeacherPassword(): string {
  const min = 100000;
  const max = 999999;
  return randomInt(min, max + 1).toString();
}

/**
 * Generate a cryptographically secure initial password for a student.
 * Returns a 12-character alphanumeric random string instead of the
 * guessable roll number.
 * @returns 12-character random password
 */
export function getStudentInitialPassword(): string {
  return generateSecurePassword(12);
}

/**
 * Validate password strength
 * @param password - Password to validate
 * @returns Object with isValid flag and error message if invalid
 */
export function validatePassword(password: string): { isValid: boolean; error?: string } {
  if (!password || password.length < 6) {
    return { isValid: false, error: 'Password must be at least 6 characters long' };
  }
  
  if (password.length > 100) {
    return { isValid: false, error: 'Password must be less than 100 characters' };
  }
  
  return { isValid: true };
}

/**
 * Generate a secure random password using crypto.randomBytes.
 * Guarantees at least one uppercase, one lowercase, one digit,
 * and one symbol by reserving the first 4 positions then filling
 * the remainder with a random selection from all character sets.
 * The result is Fisher-Yates shuffled.
 * @param length - Length of password (default: 12)
 * @returns Random password string
 */
export function generateSecurePassword(length: number = 12): string {
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  const symbols = '!@#$%^&*';
  
  const allChars = uppercase + lowercase + numbers + symbols;

  const pick = (charset: string): string =>
    charset[randomInt(0, charset.length)];

  const chars: string[] = [];

  // Ensure at least one of each type
  chars.push(pick(uppercase));
  chars.push(pick(lowercase));
  chars.push(pick(numbers));
  chars.push(pick(symbols));

  // Fill the rest using cryptographic randomness
  for (let i = chars.length; i < length; i++) {
    chars.push(pick(allChars));
  }

  // Fisher-Yates shuffle using crypto.randomInt
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(0, i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }

  return chars.join('');
}
