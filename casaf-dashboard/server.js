const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const crypto = require('crypto');
const { URL } = require('url');

const buildDir = path.join(__dirname, 'build');

const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
};

function loadEnvFile(filename) {
  const filePath = path.join(__dirname, filename);

  if (!fs.existsSync(filePath)) {
    return;
  }

  const content = fs.readFileSync(filePath, 'utf8');

  content.split('\n').forEach((line) => {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith('#')) {
      return;
    }

    const separatorIndex = trimmed.indexOf('=');

    if (separatorIndex === -1) {
      return;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, '');

    if (!process.env[key]) {
      process.env[key] = value;
    }
  });
}

loadEnvFile('.env');
loadEnvFile('.env.local');

const PORT = Number(process.env.PORT || 4173);
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || process.env.REACT_APP_OPENAI_API_KEY || '';
const OPENAI_MODEL = process.env.OPENAI_MODEL || process.env.REACT_APP_OPENAI_MODEL || 'gpt-5.2';
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.REACT_APP_SUPABASE_ANON_KEY || '';
const ASSISTANT_RATE_LIMIT_WINDOW_MS = Number(process.env.ASSISTANT_RATE_LIMIT_WINDOW_MS || 5 * 60 * 1000);
const ASSISTANT_RATE_LIMIT_MAX = Number(process.env.ASSISTANT_RATE_LIMIT_MAX || 30);
const assistantRateLimitStore = new Map();

function getRequestId() {
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getSecurityHeaders(contentType, requestId) {
  return {
    'Content-Type': contentType,
    'X-Request-Id': requestId,
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Resource-Policy': 'same-origin',
    'Cache-Control': 'no-store',
  };
}

function sendJson(res, statusCode, payload, requestId = getRequestId()) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Length': Buffer.byteLength(body),
    ...getSecurityHeaders('application/json; charset=utf-8', requestId),
  });
  res.end(body);
}

function getClientIp(req) {
  const forwardedFor = req.headers['x-forwarded-for'];

  if (typeof forwardedFor === 'string' && forwardedFor.trim()) {
    return forwardedFor.split(',')[0].trim();
  }

  return req.socket?.remoteAddress || 'unknown';
}

function isRateLimited(req) {
  const ip = getClientIp(req);
  const now = Date.now();
  const currentWindow = assistantRateLimitStore.get(ip) || [];
  const activeEntries = currentWindow.filter((timestamp) => now - timestamp < ASSISTANT_RATE_LIMIT_WINDOW_MS);

  if (activeEntries.length >= ASSISTANT_RATE_LIMIT_MAX) {
    assistantRateLimitStore.set(ip, activeEntries);
    return true;
  }

  activeEntries.push(now);
  assistantRateLimitStore.set(ip, activeEntries);
  return false;
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';

    req.on('data', (chunk) => {
      body += chunk;

      if (body.length > 1024 * 1024 * 2) {
        reject(new Error('payload_too_large'));
        req.destroy();
      }
    });

    req.on('end', () => {
      if (!body) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(new Error('invalid_json'));
      }
    });

    req.on('error', reject);
  });
}

function requestOpenAi(payload) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      ...payload,
      model: payload.model || OPENAI_MODEL,
    });

    const request = https.request(new URL('https://api.openai.com/v1/responses'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
    }, (response) => {
      let raw = '';

      response.on('data', (chunk) => {
        raw += chunk;
      });

      response.on('end', () => {
        try {
          const data = raw ? JSON.parse(raw) : {};

          if (response.statusCode >= 400) {
            reject(new Error(data?.error?.message || 'openai_error'));
            return;
          }

          resolve(data);
        } catch (error) {
          reject(error);
        }
      });
    });

    request.on('error', reject);
    request.write(body);
    request.end();
  });
}

function requestJson(targetUrl, options = {}, body = null) {
  return new Promise((resolve, reject) => {
    const request = https.request(new URL(targetUrl), options, (response) => {
      let raw = '';

      response.on('data', (chunk) => {
        raw += chunk;
      });

      response.on('end', () => {
        try {
          const data = raw ? JSON.parse(raw) : {};
          resolve({ statusCode: response.statusCode || 500, data });
        } catch (error) {
          reject(error);
        }
      });
    });

    request.on('error', reject);

    if (body) {
      request.write(body);
    }

    request.end();
  });
}

async function verifySupabaseAccessToken(token) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !token) {
    return false;
  }

  const { statusCode } = await requestJson(`${SUPABASE_URL}/auth/v1/user`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: SUPABASE_ANON_KEY,
    },
  });

  return statusCode >= 200 && statusCode < 300;
}

async function handleAssistantRequest(req, res, requestId) {
  if (!OPENAI_API_KEY) {
    sendJson(res, 503, {
      error: 'assistant_unavailable',
      message: 'Configure OPENAI_API_KEY no servidor para usar a IA remota.',
    }, requestId);
    return;
  }

  if (isRateLimited(req)) {
    sendJson(res, 429, {
      error: 'assistant_rate_limited',
      message: 'Muitas solicitações para a IA. Aguarde um instante e tente novamente.',
    }, requestId);
    return;
  }

  if (SUPABASE_URL && SUPABASE_ANON_KEY) {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    const isAuthorized = await verifySupabaseAccessToken(token);

    if (!isAuthorized) {
      sendJson(res, 401, {
        error: 'assistant_unauthorized',
        message: 'Sessão inválida para usar a IA.',
      }, requestId);
      return;
    }
  }

  try {
    const payload = await readRequestBody(req);
    const data = await requestOpenAi(payload);
    sendJson(res, 200, data, requestId);
  } catch (error) {
    sendJson(res, 500, {
      error: 'assistant_request_failed',
      message: error.message || 'Falha ao processar a solicitação da IA.',
    }, requestId);
  }
}

function serveHealthcheck(res, requestId) {
  sendJson(res, 200, {
    status: 'ok',
    service: 'casaf-dashboard',
    assistant: OPENAI_API_KEY ? 'configured' : 'local-only',
  }, requestId);
}

function getStaticCacheHeader(filePath) {
  if (filePath.includes(`${path.sep}static${path.sep}`)) {
    return 'public, max-age=31536000, immutable';
  }

  return 'no-store';
}

function serveStatic(req, res, requestId) {
  const filePath = resolveStaticPath(req.url || '/');
  const extension = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[extension] || 'application/octet-stream';

  fs.readFile(filePath, (error, content) => {
    if (error) {
      sendJson(res, 500, { error: 'static_read_failed' }, requestId);
      return;
    }

    res.writeHead(200, {
      ...getSecurityHeaders(contentType, requestId),
      'Cache-Control': getStaticCacheHeader(filePath),
    });
    res.end(content);
  });
}

const server = http.createServer(async (req, res) => {
  const requestId = getRequestId();

  if (!req.url) {
    sendJson(res, 400, { error: 'missing_url' }, requestId);
    return;
  }

  if (req.method === 'GET' && (req.url === '/healthz' || req.url === '/readyz')) {
    serveHealthcheck(res, requestId);
    return;
  }

  if (req.method === 'POST' && (req.url === '/api/assistant/obra' || req.url === '/api/assistant/portfolio')) {
    await handleAssistantRequest(req, res, requestId);
    return;
  }

  if (req.method === 'GET' || req.method === 'HEAD') {
    serveStatic(req, res, requestId);
    return;
  }

  sendJson(res, 405, { error: 'method_not_allowed' }, requestId);
});

function resolveStaticPath(pathname) {
  const normalizedPath = decodeURIComponent(pathname.split('?')[0]);
  const requestedPath = normalizedPath === '/'
    ? path.join(buildDir, 'index.html')
    : path.join(buildDir, normalizedPath);

  if (!requestedPath.startsWith(buildDir)) {
    return path.join(buildDir, 'index.html');
  }

  if (fs.existsSync(requestedPath) && fs.statSync(requestedPath).isFile()) {
    return requestedPath;
  }

  return path.join(buildDir, 'index.html');
}
server.listen(PORT, () => {
  console.log(`CASAF dashboard server running on http://localhost:${PORT}`);
});
