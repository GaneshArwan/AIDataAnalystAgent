import { URL } from 'url';
import net from 'net';
import dns from 'dns';
import { promisify } from 'util';

const lookupAsync = promisify(dns.lookup);

/**
 * Validates whether a given URL is safe from SSRF (i.e. does not resolve to private, loopback, or local IP addresses).
 * In non-production environments, it allows local requests for development.
 */
export async function isSafeUrl(urlStr: string): Promise<boolean> {
  if (!urlStr) return false;
  
  try {
    const parsed = new URL(urlStr);
    const protocol = parsed.protocol.toLowerCase();
    
    // Only allow database and standard HTTP protocols to prevent SSRF protocol-smuggling/LFI
    if (protocol !== 'postgresql:' && protocol !== 'postgres:' && protocol !== 'http:' && protocol !== 'https:') {
      return false;
    }
    
    const hostname = parsed.hostname;
    if (!hostname) return false;
    
    // Allow local development endpoints if not in production
    if (process.env.NODE_ENV !== 'production') {
      return true;
    }
    
    const normalized = hostname.trim().toLowerCase();
    
    // Block local hostnames directly
    if (normalized === 'localhost' || normalized === 'localhost.localdomain' || normalized === 'loopback') {
      return false;
    }
    
    if (normalized.endsWith('.local') || normalized.endsWith('.internal') || normalized.endsWith('.lan')) {
      return false;
    }
    
    let ip: string;
    if (net.isIP(normalized)) {
      ip = normalized;
    } else {
      try {
        const result = await lookupAsync(normalized);
        ip = result.address;
      } catch (err) {
        // Resolve failures are blocked to be safe
        return false;
      }
    }
    
    return isPublicIP(ip);
  } catch (e) {
    return false;
  }
}

/**
 * Validates that an IP address is a public IP (blocks loopback, private RFC 1918, link-local, etc.).
 */
function isPublicIP(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const parts = ip.split('.').map(Number);
    if (parts.length !== 4) return false;
    
    // Loopback: 127.0.0.0/8
    if (parts[0] === 127) return false;
    // Private Class A: 10.0.0.0/8
    if (parts[0] === 10) return false;
    // Private Class B: 172.16.0.0/12
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return false;
    // Private Class C: 192.168.0.0/16
    if (parts[0] === 192 && parts[1] === 168) return false;
    // Link-local: 169.254.0.0/16
    if (parts[0] === 169 && parts[1] === 254) return false;
    // Shared address space: 100.64.0.0/10
    if (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) return false;
    // Broadcast
    if (ip === '255.255.255.255') return false;
    
    return true;
  }
  
  if (net.isIPv6(ip)) {
    const normalized = ip.toLowerCase();
    // Loopback: ::1
    if (normalized === '::1' || normalized === '0:0:0:0:0:0:0:1') return false;
    // Link-local: fe80::/10
    if (normalized.startsWith('fe80:')) return false;
    // Unique local: fc00::/7
    if (normalized.startsWith('fc00:') || normalized.startsWith('fd00:')) return false;
    
    return true;
  }
  
  return false;
}

/**
 * Performs deep security checks on a generated SQL query:
 * 1. Strips comments and string literals to prevent injection/evasion.
 * 2. Enforces single-statement query execution (blocks semicolons inside query).
 * 3. Rejects write operations (DML/DDL) and transaction manipulation keywords.
 */
export function checkSqlSafety(sql: string): void {
  if (!sql) {
    throw new Error('Query is empty.');
  }

  // Strip block comments /* ... */
  let clean = sql.replace(/\/\*[\s\S]*?\*\//g, '');
  // Strip line comments -- ...
  clean = clean.replace(/--.*$/gm, '');
  
  // Strip standard string literals '...'
  clean = clean.replace(/'([^'\\]|\\.)*'/g, '');
  // Strip dollar-quoted string literals $$...$$
  clean = clean.replace(/\$\$[\s\S]*?\$\$/g, '');
  // Strip double-quoted identifiers "..."
  clean = clean.replace(/"([^"\\]|\\.)*"/g, '');
  
  clean = clean.trim();
  
  // Remove single trailing semicolon if it exists
  if (clean.endsWith(';')) {
    clean = clean.slice(0, -1);
  }
  
  // If a semicolon remains in the SQL structure, block it to prevent multi-statement injection
  if (clean.includes(';')) {
    throw new Error('Security Violation: Multi-statement execution is not allowed.');
  }
  
  // Forbidden DDL/DML, transaction control keywords, and dangerous system functions
  const forbiddenKeywords = [
    'DROP', 'DELETE', 'UPDATE', 'INSERT', 'ALTER', 'TRUNCATE', 'GRANT', 'REVOKE',
    'COMMIT', 'ROLLBACK', 'BEGIN', 'TRANSACTION', 'CALL', 'EXECUTE', 'COPY', 'CREATE', 'MERGE',
    'pg_sleep', 'pg_terminate_backend', 'pg_cancel_backend', 'pg_read_file', 'pg_write_file',
    'pg_ls_dir', 'pg_stat_file', 'pg_execute', 'current_setting', 'pg_advisory_lock', 'pg_try_advisory_lock'
  ];
  
  const regex = new RegExp(`\\b(${forbiddenKeywords.join('|')})\\b`, 'i');
  if (regex.test(clean)) {
    throw new Error('Security Violation: Unauthorized keyword or function usage is blocked.');
  }
}

/**
 * Sanitizes sensitive database credentials and URLs from error messages.
 */
export function sanitizeErrorMessage(message: string): string {
  if (!message) return '';
  // Mask passwords in postgresql:// or similar URIs
  let sanitized = message.replace(/(postgres(?:ql)?:\/\/)([^:]+):([^@]+)@/g, '$1$2:***@');
  // Mask potential passwords, tokens, API keys in standard database or HTTP error contexts
  sanitized = sanitized.replace(/(password|passwd|key|token|secret|authorization|bearer)\s*=\s*[^\s;]+/gi, '$1=***');
  sanitized = sanitized.replace(/(?:api_key|apikey|bearer\s+|sk-)[a-zA-Z0-9_\-]{16,}/gi, '***');
  
  // Truncate to prevent log injection/overflow (limit to 1000 characters)
  if (sanitized.length > 1000) {
    sanitized = sanitized.slice(0, 1000) + '... [truncated]';
  }
  return sanitized;
}

const ipCache = new Map<string, number[]>();

/**
 * Basic in-memory sliding-window rate limiter.
 */
export function checkRateLimit(ip: string, limit = 60, windowMs = 60000): boolean {
  const now = Date.now();
  const timestamps = ipCache.get(ip) || [];
  
  // Filter out timestamps outside the active window
  const active = timestamps.filter(t => now - t < windowMs);
  
  if (active.length >= limit) {
    return false;
  }
  
  active.push(now);
  ipCache.set(ip, active);
  
  // Periodic cleanup of cache to prevent memory bloat
  if (ipCache.size > 1000) {
    for (const [key, val] of ipCache.entries()) {
      const filtered = val.filter(t => now - t < windowMs);
      if (filtered.length === 0) {
        ipCache.delete(key);
      } else {
        ipCache.set(key, filtered);
      }
    }
  }
  
  return true;
}

/**
 * Extracts client IP address from HTTP request headers.
 */
export function getClientIp(req: any): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return req.headers.get('x-real-ip') || '127.0.0.1';
}

