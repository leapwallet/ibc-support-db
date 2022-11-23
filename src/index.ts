/**
 * Welcome to Cloudflare Workers! This is your first scheduled worker.
 *
 * - Run `wrangler dev --local` in your terminal to start a development server
 * - Run `curl "http://localhost:8787/cdn-cgi/mf/scheduled"` to trigger the scheduled event
 * - Go back to the console to see what your worker has logged
 * - Update the Cron trigger in wrangler.toml (see https://developers.cloudflare.com/workers/wrangler/configuration/#triggers)
 * - Run `wrangler publish --name my-worker` to publish your worker
 *
 * Learn more at https://developers.cloudflare.com/workers/runtime-apis/scheduled-event/
 */
import { parse } from 'node-html-parser';

export interface Env {
  // Example binding to KV. Learn more at https://developers.cloudflare.com/workers/runtime-apis/kv/
  IBC_SUPPORT_DATA: KVNamespace;
}

const chainPairJsonMatcher = /^[a-z]+-[a-z]+$/;
const chainMatcher = /^[a-z]+$/;

const successfulInit = {
  status: 200,
  headers: {
    'content-type': 'application/json',
  },
};

const notFound = () =>
  new Response('Not Found', {
    status: 404,
  });

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const { pathname } = new URL(request.url);
    const [, basePath] = pathname.split('/');

    if (basePath === '') {
      const ibcSupportData = await env.IBC_SUPPORT_DATA.get('all', {
        type: 'json',
      });
      if (ibcSupportData === null) {
        return notFound();
      }
      return new Response(JSON.stringify(ibcSupportData), successfulInit);
    } else if (chainPairJsonMatcher.test(basePath)) {
      const ibcSupportData = await env.IBC_SUPPORT_DATA.get(basePath, {
        type: 'json',
      });
      if (ibcSupportData === null) {
        return notFound();
      }
      return new Response(JSON.stringify(ibcSupportData), successfulInit);
    } else if (chainMatcher.test(basePath)) {
      const ibcSupportData: Record<string, any> | null =
        await env.IBC_SUPPORT_DATA.get('all', {
          type: 'json',
        });
      if (ibcSupportData === null) {
        return notFound();
      }
      const data = ibcSupportData[basePath];
      if (data === undefined) {
        return notFound();
      }
      return new Response(JSON.stringify(data), successfulInit);
    }
    return notFound();
  },
  async scheduled(
    controller: ScheduledController,
    env: Env,
    ctx: ExecutionContext
  ): Promise<void> {
    console.log('CRON Started');
    try {
      const response = await fetch(
        'https://proxy.atomscan.com/directory/_IBC/',
        {
          headers: {
            'content-type': 'text/html;charset=UTF-8',
          },
        }
      );
      if (!response.ok) {
        throw new Error('Response not ok');
      }
      const rawHTML = await response.text();
      const root = parse(rawHTML);
      const elements = root.querySelectorAll('.line > a[href$=".json"]');
      const ibcSupport: Record<string, string[]> = {};
      const hrefs: string[] = [];
      elements.forEach((element) => {
        const href = element.getAttribute('href');
        if (href) {
          hrefs.push(href);
          const [src, dest] = href.slice(0, -5).split('-');
          if (ibcSupport[src]) {
            ibcSupport[src].push(dest);
          } else {
            ibcSupport[src] = [dest];
          }
        }
      });
      await env.IBC_SUPPORT_DATA.put('all', JSON.stringify(ibcSupport));
      await Promise.all(
        hrefs.map(async (href) => {
          const res = await fetch(
            `https://proxy.atomscan.com/directory/_IBC/${href}`
          );
          const data = await res.json();
          await env.IBC_SUPPORT_DATA.put(
            href.slice(0, -5),
            JSON.stringify(data)
          );
        })
      );
      console.log('CRON Success');
    } catch (err) {
      console.log('CRON Error', err);
    }
    console.log('CRON Ended');
  },
};
