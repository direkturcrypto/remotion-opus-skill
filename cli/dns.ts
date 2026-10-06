// Some machines' system resolver (macOS mDNSResponder) caches a failed lookup and keeps returning ENOTFOUND for a
// host that is up. Fall back to querying the configured DNS servers directly so API calls keep working.
import dns from 'node:dns';
import { Agent, setGlobalDispatcher } from 'undici';

const resolver = new dns.Resolver();
const cache = new Map<string, string>();

const lookup: typeof dns.lookup = ((host: string, opts: dns.LookupOptions | number | ((...a: unknown[]) => void), cb?: (...a: unknown[]) => void) => {
  const callback = (typeof opts === 'function' ? opts : cb) as (err: NodeJS.ErrnoException | null, address?: string | dns.LookupAddress[], family?: number) => void;
  const options = (typeof opts === 'object' ? opts : {}) as dns.LookupOptions;
  dns.lookup(host, { ...options, all: false }, (err, address, family) => {
    if (!err) return options.all ? callback(null, [{ address: address as string, family: family as number }]) : callback(null, address as string, family as number);
    const hit = cache.get(host);
    const done = (ip: string) => (options.all ? callback(null, [{ address: ip, family: 4 }]) : callback(null, ip, 4));
    if (hit) return done(hit);
    resolver.resolve4(host, (e2, ips) => {
      if (e2 || !ips?.length) return callback(err);
      cache.set(host, ips[0]);
      done(ips[0]);
    });
  });
}) as typeof dns.lookup;

setGlobalDispatcher(new Agent({ connect: { lookup } }));
