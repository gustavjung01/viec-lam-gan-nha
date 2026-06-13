import dotenv from 'dotenv';
import crypto from 'crypto';

dotenv.config();



// Function to verify a JWT-like token using HMAC
function verifySessionToken(token, secret) {
  try {
    const [headerEncoded, payloadEncoded, signature] = token.split('.');
    const unsignedToken = `${headerEncoded}.${payloadEncoded}`;

    const expectedSignature = crypto.createHmac('sha256', secret)
                                  .update(unsignedToken)
                                  .digest('base64url');

    // Use timingSafeEqual to prevent timing attacks
    if (!crypto.timingSafeEqual(Buffer.from(signature, 'base64url'), Buffer.from(expectedSignature, 'base64url'))) {
      return null; // Invalid signature
    }

    const payload = JSON.parse(Buffer.from(payloadEncoded, 'base64url').toString('utf8'));

    // Check expiration
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null; // Token expired
    }

    return payload; // Token is valid, return payload
  } catch (error) {
    return null; // Token is malformed or other error
  }
}

export function adminAuth(req, res, next) {
  const ADMIN_SESSION_SECRET = process.env.ADMIN_SESSION_SECRET;
  const ADMIN_API_TOKEN = process.env.ADMIN_API_TOKEN;
  if (!ADMIN_SESSION_SECRET) {
    // Fallback if session secret is not configured, but API token might still be
    if (!ADMIN_API_TOKEN) {
      console.warn('Neither ADMIN_SESSION_SECRET nor ADMIN_API_TOKEN is configured in .env');
      return res.status(503).json({ success: false, message: 'ADMIN_LOGIN_NOT_CONFIGURED' });
    }
  }

  const authHeader = req.headers.authorization || '';
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;

  if (bearerToken) {
    if (!ADMIN_SESSION_SECRET) {
      return res.status(503).json({ success: false, message: 'ADMIN_LOGIN_NOT_CONFIGURED' });
    }
    const user = verifySessionToken(bearerToken, ADMIN_SESSION_SECRET);
    if (user) {
      req.user = user; // Attach user payload to request
      return next();
    } else {
      return res.status(403).json({ success: false, message: 'INVALID_ADMIN_SESSION' });
    }
  }

  // Fallback to legacy x-admin-token if no bearer token
  const headerToken = req.headers['x-admin-token'];
  if (headerToken) {
    if (ADMIN_API_TOKEN && headerToken === ADMIN_API_TOKEN) {
      req.user = { email: 'legacy_admin', role: 'admin' }; // Mock user for legacy token
      return next();
    } else {
      return res.status(403).json({ success: false, message: 'INVALID_ADMIN_TOKEN' });
    }
  }

  // No token provided
  return res.status(401).json({ success: false, message: 'MISSING_ADMIN_SESSION' });
}
