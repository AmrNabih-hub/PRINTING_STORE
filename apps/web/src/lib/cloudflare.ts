import type { D1Database, Queue, R2Bucket } from '@cloudflare/workers-types';

export interface CloudflareEnv {
  DB: D1Database;
  ORDER_QUEUE: Queue;
  PRINT_ASSETS: R2Bucket;
}

// Global cache for development to avoid memory leaks on HMR (Hot Module Replacement)
declare global {
  // eslint-disable-next-line no-var
  var __cfProxy: { env: CloudflareEnv; dispose: () => Promise<void> } | undefined;
}

/**
 * Utility to safely access Cloudflare bindings (D1, Queue, R2) in Next.js API routes.
 * Uses getRequestContext in production (@cloudflare/next-on-pages) and 
 * getPlatformProxy from wrangler in local development.
 */
export async function getCloudflareContext(): Promise<CloudflareEnv> {
  // In production, context is provided by @cloudflare/next-on-pages
  if (process.env.NODE_ENV === 'production') {
    try {
      // Lazy import to avoid breaking local dev
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      const { getRequestContext } = await import('@cloudflare/next-on-pages');
      const ctx = getRequestContext();
      return ctx.env as CloudflareEnv;
    } catch (err) {
      console.warn('Failed to load @cloudflare/next-on-pages context. Falling back to process.env');
      return process.env as unknown as CloudflareEnv;
    }
  }

  // Local development via getPlatformProxy
  if (!global.__cfProxy) {
    try {
      // Lazy import wrangler so it doesn't try to bundle it in prod
      const { getPlatformProxy } = await import('wrangler');
      global.__cfProxy = await getPlatformProxy<CloudflareEnv>({
        persist: true, // Persist local D1 and R2 data across restarts
      });
    } catch (err) {
      console.error('Failed to initialize wrangler getPlatformProxy', err);
      throw err;
    }
  }

  return global.__cfProxy.env;
}
