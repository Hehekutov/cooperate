const {
  randomBytes,
  randomUUID,
  scryptSync,
  timingSafeEqual
} = require('node:crypto');

const { badRequest } = require('./errors');

function createId(prefix) {
  return `${prefix}_${randomUUID()}`;
}

function generateToken() {
  return randomBytes(32).toString('hex');
}

function normalizePhone(phone) {
  const digits = String(phone ?? '').replace(/\D/g, '');

  if (digits.length < 10) {
    throw badRequest('Phone number must contain at least 10 digits');
  }

  return `+${digits}`;
}

function hashPassword(password) {
  const normalized = String(password ?? '');

  if (normalized.length < 6) {
    throw badRequest('Password must contain at least 6 characters');
  }

  const salt = randomBytes(16).toString('hex');
  const digest = scryptSync(normalized, salt, 64).toString('hex');

  return `${salt}:${digest}`;
}

function verifyPassword(password, storedHash) {
  const [salt, digest] = String(storedHash ?? '').split(':');

  if (!salt || !digest) {
    return false;
  }

  const candidate = scryptSync(String(password ?? ''), salt, 64);
  const original = Buffer.from(digest, 'hex');

  if (candidate.length !== original.length) {
    return false;
  }

  return timingSafeEqual(candidate, original);
}

module.exports = {
  createId,
  generateToken,
  hashPassword,
  normalizePhone,
  verifyPassword
};
