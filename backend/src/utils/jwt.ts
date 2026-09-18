import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET && process.env.NODE_ENV === 'production') {
  throw new Error('JWT_SECRET environment variable must be set in production');
}

const JWT_SECRET_FINAL = JWT_SECRET ?? 'dev-only-not-for-production';
const TOKEN_EXPIRY = '24h';

export interface JwtPayload {
  userId: string;
  email: string;
  jti?: string; // session id for revocation
}

export function signToken(payload: JwtPayload): string {
  // jsonwebtoken: if you pass jwtid option AND payload has jti, it errors.
  // So we pass jti via the payload and let jsonwebtoken set the jti header field.
  return jwt.sign(payload, JWT_SECRET_FINAL, { expiresIn: TOKEN_EXPIRY });
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET_FINAL) as JwtPayload;
  } catch {
    return null;
  }
}
