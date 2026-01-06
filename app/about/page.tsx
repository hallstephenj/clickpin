import Link from 'next/link';

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-[#fafafa] dark:bg-[#0a0a0a]">
      {/* Header */}
      <header className="border-b border-[var(--border)]">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 hover:opacity-80">
            <span className="text-[#f7931a] font-bold text-lg">⚡</span>
            <span className="font-bold">clickpin</span>
          </Link>
          <Link href="/" className="btn">
            ← back
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-2xl mx-auto px-4 py-8">
        {/* Hero */}
        <div className="text-center mb-12">
          <div className="text-6xl mb-4">⚡</div>
          <h1 className="text-3xl font-bold mb-2">clickpin</h1>
          <p className="text-[var(--fg-muted)] font-mono">
            if you're not there, you can't see it
          </p>
        </div>

        {/* What is it */}
        <section className="mb-10">
          <h2 className="font-bold text-lg mb-3 border-b border-[var(--border)] pb-2">
            what is clickpin?
          </h2>
          <div className="space-y-3 text-[var(--fg-muted)]">
            <p>
              clickpin is an anonymous, hyperlocal message board. posts are tied to
              physical locations — you can only see and create posts when you're
              actually there. no remote viewing. no screenshots that matter. you
              have to show up.
            </p>
            <p>
              think of it as peeking behind the curtain of the local underground.
              each board is scarce by design — only people physically present can
              read or write. no accounts, no followers, no algorithms. just
              posts from people who earned access by being there.
            </p>
          </div>
        </section>

        {/* How it works */}
        <section className="mb-10">
          <h2 className="font-bold text-lg mb-3 border-b border-[var(--border)] pb-2">
            how it works
          </h2>
          <div className="space-y-4">
            <div className="flex gap-4">
              <span className="text-[#f7931a] font-mono font-bold">1.</span>
              <div>
                <div className="font-medium">allow location access</div>
                <p className="text-sm text-[var(--fg-muted)]">
                  clickpin needs your location to find nearby boards. your exact
                  position is never stored — we only verify you're within range.
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <span className="text-[#f7931a] font-mono font-bold">2.</span>
              <div>
                <div className="font-medium">find a board</div>
                <p className="text-sm text-[var(--fg-muted)]">
                  if you're near an active location, you'll see its board. each
                  board is unique to that spot — scarce, local, yours to discover.
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <span className="text-[#f7931a] font-mono font-bold">3.</span>
              <div>
                <div className="font-medium">post anonymously</div>
                <p className="text-sm text-[var(--fg-muted)]">
                  write up to 280 characters. optionally add a doodle. no account
                  needed — your device gets a random ID for rate limiting only.
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <span className="text-[#f7931a] font-mono font-bold">4.</span>
              <div>
                <div className="font-medium">community moderation</div>
                <p className="text-sm text-[var(--fg-muted)]">
                  flag inappropriate posts. after enough flags, posts are hidden.
                  no central moderators — the community decides.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Scarcity */}
        <section className="mb-10">
          <h2 className="font-bold text-lg mb-3 border-b border-[var(--border)] pb-2">
            scarcity by design
          </h2>
          <div className="space-y-3 text-[var(--fg-muted)]">
            <p>
              clickpin boards are intentionally scarce. you can't scroll through
              an infinite feed from your couch — you have to go somewhere to see
              what's there.
            </p>
            <ul className="space-y-2 ml-4">
              <li className="flex gap-2">
                <span className="text-[#f7931a]">•</span>
                <span><strong>location-locked:</strong> content only visible to people physically present</span>
              </li>
              <li className="flex gap-2">
                <span className="text-[#f7931a]">•</span>
                <span><strong>limited posts:</strong> 3 free per location per day keeps boards authentic</span>
              </li>
              <li className="flex gap-2">
                <span className="text-[#f7931a]">•</span>
                <span><strong>ephemeral:</strong> posts age and eventually fade — nothing lasts forever</span>
              </li>
              <li className="flex gap-2">
                <span className="text-[#f7931a]">•</span>
                <span><strong>earned access:</strong> you can't buy your way in, you have to show up</span>
              </li>
            </ul>
            <p className="text-sm font-mono text-[var(--fg-faint)]">
              scarcity plus locality equals gossip fuel — the oldest viral loop in human history.
            </p>
          </div>
        </section>

        {/* Lightning payments */}
        <section className="mb-10">
          <h2 className="font-bold text-lg mb-3 border-b border-[var(--border)] pb-2">
            ⚡ lightning payments
          </h2>
          <div className="space-y-3 text-[var(--fg-muted)]">
            <p>
              clickpin uses bitcoin lightning for optional paid features:
            </p>
            <ul className="space-y-2 ml-4">
              <li className="flex gap-2">
                <span className="text-[#f7931a]">•</span>
                <span><strong>free posts:</strong> 3 per location per day</span>
              </li>
              <li className="flex gap-2">
                <span className="text-[#f7931a]">•</span>
                <span><strong>paid posts:</strong> keep posting after your free quota</span>
              </li>
              <li className="flex gap-2">
                <span className="text-[#f7931a]">•</span>
                <span><strong>boost:</strong> pin your post to the top for 24 hours</span>
              </li>
              <li className="flex gap-2">
                <span className="text-[#f7931a]">•</span>
                <span><strong>delete:</strong> free within 10 min, paid after</span>
              </li>
              <li className="flex gap-2">
                <span className="text-[#f7931a]">•</span>
                <span><strong>sponsor:</strong> put your name on a location</span>
              </li>
            </ul>
            <p className="text-sm">
              payments are instant, private, and keep the service running without
              ads or data harvesting.
            </p>
          </div>
        </section>

        {/* Privacy */}
        <section className="mb-10">
          <h2 className="font-bold text-lg mb-3 border-b border-[var(--border)] pb-2">
            privacy
          </h2>
          <div className="space-y-3 text-[var(--fg-muted)]">
            <ul className="space-y-2">
              <li className="flex gap-2">
                <span className="text-[var(--fg-faint)]">→</span>
                <span>no accounts or personal information collected</span>
              </li>
              <li className="flex gap-2">
                <span className="text-[var(--fg-faint)]">→</span>
                <span>location is only used for proximity verification</span>
              </li>
              <li className="flex gap-2">
                <span className="text-[var(--fg-faint)]">→</span>
                <span>your coordinates are never stored in our database</span>
              </li>
              <li className="flex gap-2">
                <span className="text-[var(--fg-faint)]">→</span>
                <span>device ID is random and can be cleared anytime</span>
              </li>
              <li className="flex gap-2">
                <span className="text-[var(--fg-faint)]">→</span>
                <span>no tracking, no cookies, no analytics</span>
              </li>
            </ul>
          </div>
        </section>

        {/* Technical */}
        <section className="mb-10">
          <h2 className="font-bold text-lg mb-3 border-b border-[var(--border)] pb-2">
            technical
          </h2>
          <div className="font-mono text-sm text-[var(--fg-muted)] space-y-1">
            <p>built with next.js + supabase + postgis</p>
            <p>payments via bitcoin lightning network</p>
            <p>location accuracy required: ≤100m</p>
            <p>board radius: 150-500m per location</p>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-[var(--border)] mt-8">
        <div className="max-w-2xl mx-auto px-4 py-6 text-center text-xs text-[var(--fg-faint)] font-mono">
          <p>clickpin • scarce • ephemeral • hyperlocal</p>
          <p className="mt-1">powered by bitcoin</p>
        </div>
      </footer>
    </div>
  );
}
