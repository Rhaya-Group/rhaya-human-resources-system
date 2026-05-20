// backend/src/middleware/hmacAuth.js
import crypto from "crypto";

// Map of client IDs to env vars holding their shared secrets
const CLIENT_SECRETS = {
  "legal-crm": "HR_LEGAL_SECRET",
  inventory: "HR_INVENTORY_SECRET",
};

const MAX_AGE_MS = 5 * 60 * 1000; // 5 minutes
const EMPTY_BODY_HASH = crypto.createHash("sha256").update("").digest("hex");

// ✅ DUAL FORMAT SUPPORT - Remove after migration complete
const ENABLE_LEGACY_FORMAT = process.env.HMAC_ENABLE_LEGACY === "true";

/**
 * Normalize query parameters by sorting them alphabetically
 * Prevents signature mismatches due to parameter order
 */
function normalizeQueryParams(urlString) {
  try {
    const parsed = new URL(urlString, "http://localhost");
    const sortedParams = [...parsed.searchParams.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join("&");

    return sortedParams
      ? `${parsed.pathname}?${sortedParams}`
      : parsed.pathname;
  } catch (error) {
    // Fallback if URL parsing fails
    return urlString;
  }
}

/**
 * Verify NEW format: timestamp.method.path.bodyHash
 */
function verifyNewFormat(req, secret) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("HMAC ")) {
    return { success: false, error: "Missing HMAC authorization" };
  }

  const [, credentials] = authHeader.split(" ");
  const [timestamp, signature] = credentials.split(".");

  if (!timestamp || !signature) {
    return { success: false, error: "Malformed HMAC header" };
  }

  // Reject stale requests
  const age = Date.now() - Number(timestamp);
  if (age > MAX_AGE_MS || age < 0) {
    return { success: false, error: "Request timestamp out of range" };
  }

  // Build signing payload from the actual request
  const method = req.method.toUpperCase();
  const pathWithQuery = normalizeQueryParams(req.originalUrl);
  const bodyStr = req.rawBody || "";
  const bodyHash =
    bodyStr && bodyStr.trim()
      ? crypto.createHash("sha256").update(bodyStr).digest("hex")
      : EMPTY_BODY_HASH;

  const payload = `${timestamp}.${method}.${pathWithQuery}.${bodyHash}`;

  // Compute expected signature
  const expected = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex");

  // Constant-time comparison
  const expectedBuf = Buffer.from(expected, "hex");
  const receivedBuf = Buffer.from(signature, "hex");

  if (
    expectedBuf.length !== receivedBuf.length ||
    !crypto.timingSafeEqual(expectedBuf, receivedBuf)
  ) {
    return { success: false, error: "Invalid HMAC signature" };
  }

  return { success: true, format: "new" };
}

/**
 * Verify LEGACY format: timestamp only (for backwards compatibility)
 */
function verifyLegacyFormat(req, secret) {
  if (!ENABLE_LEGACY_FORMAT) {
    return { success: false, error: "Legacy format disabled" };
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("HMAC ")) {
    return { success: false, error: "Missing HMAC authorization" };
  }

  const [, credentials] = authHeader.split(" ");
  const [timestamp, signature] = credentials.split(".");

  if (!timestamp || !signature) {
    return { success: false, error: "Malformed HMAC header" };
  }

  // Reject stale requests
  const age = Date.now() - Number(timestamp);
  if (age > MAX_AGE_MS || age < 0) {
    return { success: false, error: "Request timestamp out of range" };
  }

  // Legacy: sign timestamp only
  const expected = crypto
    .createHmac("sha256", secret)
    .update(timestamp)
    .digest("hex");

  // Constant-time comparison
  const expectedBuf = Buffer.from(expected, "hex");
  const receivedBuf = Buffer.from(signature, "hex");

  if (
    expectedBuf.length !== receivedBuf.length ||
    !crypto.timingSafeEqual(expectedBuf, receivedBuf)
  ) {
    return { success: false, error: "Invalid HMAC signature" };
  }

  return { success: true, format: "legacy" };
}

/**
 * HMAC authentication middleware
 * Supports both new (secure) and legacy (deprecated) formats during migration
 */
export function hmacAuth(req, res, next) {
  const startTime = Date.now();

  // 1. Identify the calling client
  const clientId = req.headers["x-client-id"];
  if (!clientId) {
    console.warn("[hmacAuth] Missing X-Client-Id header", {
      ip: req.ip,
      path: req.originalUrl,
    });
    return res.status(401).json({ error: "Missing X-Client-Id header" });
  }

  const secretEnvVar = CLIENT_SECRETS[clientId];
  if (!secretEnvVar) {
    console.warn("[hmacAuth] Unknown client", {
      clientId,
      ip: req.ip,
      path: req.originalUrl,
    });
    return res.status(401).json({ error: "Unknown client" });
  }

  const secret = process.env[secretEnvVar];
  if (!secret) {
    console.error(`[hmacAuth] Secret env var ${secretEnvVar} not set`);
    return res.status(500).json({ error: "Server misconfiguration" });
  }

  // 2. Try new format first (preferred)
  const newResult = verifyNewFormat(req, secret);
  if (newResult.success) {
    req.clientId = clientId;

    // Log successful authentication
    console.log("[hmacAuth] Success (new format)", {
      clientId,
      method: req.method,
      path: req.originalUrl,
      duration: Date.now() - startTime,
    });

    return next();
  }

  // 3. Fallback to legacy format if enabled
  const legacyResult = verifyLegacyFormat(req, secret);
  if (legacyResult.success) {
    req.clientId = clientId;

    // ⚠️ Warn that client is using deprecated format
    console.warn("[hmacAuth] Success (LEGACY format - DEPRECATED)", {
      clientId,
      method: req.method,
      path: req.originalUrl,
      duration: Date.now() - startTime,
      message: "Client should upgrade to new HMAC format",
    });

    return next();
  }

  // 4. Both formats failed - reject
  console.warn("[hmacAuth] Authentication failed", {
    clientId,
    method: req.method,
    path: req.originalUrl,
    newFormatError: newResult.error,
    legacyFormatError: legacyResult.error,
    ip: req.ip,
    duration: Date.now() - startTime,
  });

  return res.status(401).json({
    error: "Invalid HMAC signature",
    // Don't leak specific error in production
    ...(process.env.NODE_ENV === "development" && {
      details: newResult.error,
    }),
  });
}

/**
 * Helper function for consumers to generate HMAC signatures
 * (For testing/documentation purposes)
 */
export function generateHMAC(method, url, body, secret) {
  const timestamp = Date.now().toString();
  const pathWithQuery = normalizeQueryParams(url);
  const bodyStr = body ? JSON.stringify(body) : "";
  const bodyHash =
    bodyStr && bodyStr.trim()
      ? crypto.createHash("sha256").update(bodyStr).digest("hex")
      : EMPTY_BODY_HASH;

  const payload = `${timestamp}.${method.toUpperCase()}.${pathWithQuery}.${bodyHash}`;
  const signature = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex");

  return {
    timestamp,
    signature,
    authorization: `HMAC ${timestamp}.${signature}`,
  };
}
