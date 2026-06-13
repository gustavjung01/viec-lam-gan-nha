import { verifyToken } from '@clerk/backend';

/**
 * User authentication middleware using Clerk JWT
 * Requires CLERK_SECRET_KEY in environment
 * Uses official @clerk/backend SDK for token verification
 *
 * Env required:
 * - CLERK_SECRET_KEY: Clerk secret key
 * - CLERK_PUBLISHABLE_KEY: Clerk publishable key (for authorizedParties)
 */
export async function userAuth(req, res, next) {
  const secretKey = process.env.CLERK_SECRET_KEY;
  const publishableKey = process.env.CLERK_PUBLISHABLE_KEY;

  if (!secretKey) {
    return res.status(503).json({
      success: false,
      error: 'CLERK_NOT_CONFIGURED',
      message: 'CLERK_SECRET_KEY is not configured.'
    });
  }

  const authHeader = req.headers.authorization || '';
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;

  if (!bearerToken) {
    return res.status(401).json({
      success: false,
      error: 'MISSING_TOKEN',
      message: 'Authorization token is required.'
    });
  }

  try {
    const payload = await verifyToken(bearerToken, {
      secretKey,
      authorizedParties: [
        'https://vieclamgannha.me',
        'https://preview.vieclamgannha.me',
        'http://localhost:5173',
      ],
    });

    req.user = {
      clerkUserId: payload.sub,
      email: payload.email || payload.external_accounts?.[0]?.email_address || null,
      firstName: payload.given_name || null,
      lastName: payload.family_name || null,
    };

    return next();
  } catch (err) {
    if (err.message?.includes('expired') || err.message?.includes('TokenExpiredError')) {
      return res.status(401).json({
        success: false,
        error: 'TOKEN_EXPIRED',
        message: 'Authorization token has expired.'
      });
    }
    return res.status(401).json({
      success: false,
      error: 'INVALID_TOKEN',
      message: 'Authorization token is invalid.'
    });
  }
}