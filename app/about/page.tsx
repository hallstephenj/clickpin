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
              actually there. 
            </p>
            <p>
              think of it as peeking behind the curtain of the local underground. only people physically present can
              read or write. no accounts, no followers, no algorithms. just
              posts from people who have been where you are.
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
                <span><strong>sponsor:</strong> put your name on a location (see below)</span>
              </li>
            </ul>
            <p className="text-sm">
              payments are instant, private, and keep the service running without
              ads or data harvesting.
            </p>
          </div>
        </section>

        {/* How sponsorship works */}
        <section className="mb-10">
          <h2 className="font-bold text-lg mb-3 border-b border-[var(--border)] pb-2">
            how sponsorship works
          </h2>
          <div className="space-y-3 text-[var(--fg-muted)]">
            <p>
              anyone can sponsor a board. your name appears at the top of the
              board for everyone to see.
            </p>
            <ul className="space-y-2 ml-4">
              <li className="flex gap-2">
                <span className="text-[#f7931a]">•</span>
                <span><strong>starting bid:</strong> 5 sats minimum for unsponsored boards</span>
              </li>
              <li className="flex gap-2">
                <span className="text-[#f7931a]">•</span>
                <span><strong>outbidding:</strong> to take over, pay at least 1 sat more than the current sponsor</span>
              </li>
              <li className="flex gap-2">
                <span className="text-[#f7931a]">•</span>
                <span><strong>24-hour minimum:</strong> every sponsor gets at least 24 hours before they can be replaced</span>
              </li>
              <li className="flex gap-2">
                <span className="text-[#f7931a]">•</span>
                <span><strong>indefinite:</strong> your sponsorship lasts until someone outbids you (after your 24hr window)</span>
              </li>
            </ul>
            <p className="text-sm font-mono text-[var(--fg-faint)]">
              sponsorship is a way to support your favorite spots and get your name out there.
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

        
      </main>

      {/* Footer */}
      <footer className="border-t border-[var(--border)] mt-8">
        <div className="max-w-2xl mx-auto px-4 py-6 text-center text-xs text-[var(--fg-faint)] font-mono">
          <a href="/terms" className="hover:text-[var(--accent)]">terms</a>
          {' • '}
          <a href="/privacy" className="hover:text-[var(--accent)]">privacy</a>
          <p className="mt-2">powered by bitcoin</p>
        </div>
      </footer>
    </div>
  );
}
