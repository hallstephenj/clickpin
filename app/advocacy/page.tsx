'use client';

import Link from 'next/link';
import { Lightning, Plant } from '@phosphor-icons/react';

export default function AdvocacyPage() {
  return (
    <div className="min-h-screen bg-[#fafafa] dark:bg-[#0a0a0a]">
      {/* Header */}
      <header className="border-b border-[var(--border)]">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 hover:opacity-80">
            <Lightning size={20} weight="fill" className="text-[#f7931a]" />
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
          <Plant size={64} weight="fill" className="text-green-600 mx-auto mb-4" />
          <h1 className="text-3xl font-bold mb-2">orange-pilling merchants</h1>
          <p className="text-[var(--fg-muted)] font-mono">
            a friendly guide to helping local businesses discover bitcoin
          </p>
        </div>

        {/* The Approach */}
        <section className="mb-10">
          <h2 className="font-bold text-lg mb-3 border-b border-[var(--border)] pb-2">
            the approach
          </h2>
          <div className="space-y-3 text-[var(--fg-muted)]">
            <p>
              the best way to help merchants accept bitcoin is through genuine,
              helpful conversations — not pressure or preaching. be a customer
              first, then a friend sharing something useful.
            </p>
            <ul className="space-y-2 ml-4">
              <li className="flex gap-2">
                <span className="text-[#f7931a]">•</span>
                <span><strong>be genuine and helpful,</strong> not pushy</span>
              </li>
              <li className="flex gap-2">
                <span className="text-[#f7931a]">•</span>
                <span><strong>start as a customer first</strong> — build rapport</span>
              </li>
              <li className="flex gap-2">
                <span className="text-[#f7931a]">•</span>
                <span><strong>focus on benefits relevant to them</strong> — lower fees, no chargebacks</span>
              </li>
              <li className="flex gap-2">
                <span className="text-[#f7931a]">•</span>
                <span><strong>one conversation at a time</strong> — plant seeds, don't pressure</span>
              </li>
            </ul>
          </div>
        </section>

        {/* Opening Lines */}
        <section className="mb-10">
          <h2 className="font-bold text-lg mb-3 border-b border-[var(--border)] pb-2">
            sample scripts
          </h2>
          <div className="space-y-3 text-[var(--fg-muted)]">
            <p>
              opening lines to start the conversation:
            </p>
            <ul className="space-y-2 ml-4">
              <li className="flex gap-2">
                <span className="text-[var(--fg-faint)]">→</span>
                <span className="italic">"Hey, I noticed you don't accept Bitcoin yet. Have you ever considered it?"</span>
              </li>
              <li className="flex gap-2">
                <span className="text-[var(--fg-faint)]">→</span>
                <span className="italic">"I love shopping here! Quick question — do you take Bitcoin?"</span>
              </li>
              <li className="flex gap-2">
                <span className="text-[var(--fg-faint)]">→</span>
                <span className="italic">"I'm trying to spend more Bitcoin locally. Any chance you'd consider accepting it?"</span>
              </li>
            </ul>
          </div>
        </section>

        {/* If They're Curious */}
        <section className="mb-10">
          <h2 className="font-bold text-lg mb-3 border-b border-[var(--border)] pb-2">
            if they're curious
          </h2>
          <div className="space-y-3 text-[var(--fg-muted)]">
            <p>
              talking points for interested merchants:
            </p>
            <ul className="space-y-2 ml-4">
              <li className="flex gap-2">
                <span className="text-[#f7931a]">•</span>
                <span><strong>lower fees:</strong> Lightning payments cost fractions of a penny vs 2-3% card fees</span>
              </li>
              <li className="flex gap-2">
                <span className="text-[#f7931a]">•</span>
                <span><strong>no chargebacks:</strong> Bitcoin payments are final — no fraud disputes</span>
              </li>
              <li className="flex gap-2">
                <span className="text-[#f7931a]">•</span>
                <span><strong>instant settlement:</strong> money in your account immediately, 24/7</span>
              </li>
              <li className="flex gap-2">
                <span className="text-[#f7931a]">•</span>
                <span><strong>new customers:</strong> Bitcoiners actively seek out accepting merchants</span>
              </li>
              <li className="flex gap-2">
                <span className="text-[#f7931a]">•</span>
                <span><strong>easy setup:</strong> free point-of-sale apps work on any phone</span>
              </li>
            </ul>
          </div>
        </section>

        {/* Common Objections */}
        <section className="mb-10">
          <h2 className="font-bold text-lg mb-3 border-b border-[var(--border)] pb-2">
            common objections
          </h2>
          <div className="space-y-4 text-[var(--fg-muted)]">
            <div>
              <p className="font-medium text-[var(--fg)]">"It's too volatile"</p>
              <p className="text-sm mt-1">
                "That's a fair concern! You can convert to dollars instantly if you want.
                Services like Strike or Zaprite let you accept Bitcoin but receive dollars
                automatically. Zero volatility risk, but you still get lower fees and no chargebacks."
              </p>
            </div>
            <div>
              <p className="font-medium text-[var(--fg)]">"It's too complicated"</p>
              <p className="text-sm mt-1">
                "It used to be, but not anymore! There are apps now as simple as Venmo or Cash App.
                I can show you on my phone right now — it literally takes 30 seconds to set up.
                Your staff can learn it in minutes."
              </p>
            </div>
            <div>
              <p className="font-medium text-[var(--fg)]">"We don't have the technical know-how"</p>
              <p className="text-sm mt-1">
                "That's totally understandable. Modern Bitcoin payment apps are dead simple — just
                tap 'receive', enter the amount, show the customer the QR code. That's it."
              </p>
            </div>
            <div>
              <p className="font-medium text-[var(--fg)]">"Our customers don't use it"</p>
              <p className="text-sm mt-1">
                "You might be surprised! There's a growing community of Bitcoiners who specifically
                seek out businesses that accept it. Getting listed on BTCMap brings visibility to
                this whole community."
              </p>
            </div>
            <div>
              <p className="font-medium text-[var(--fg)]">"What about taxes?"</p>
              <p className="text-sm mt-1">
                "Great question — it's simpler than you might think. If you convert to dollars
                immediately (which most services do automatically), it's just like any other sale.
                Your accountant can handle it like any other revenue."
              </p>
            </div>
          </div>
        </section>

        {/* Resources */}
        <section className="mb-10">
          <h2 className="font-bold text-lg mb-3 border-b border-[var(--border)] pb-2">
            resources
          </h2>
          <div className="space-y-3 text-[var(--fg-muted)]">
            <p>
              helpful links to share with interested merchants:
            </p>
            <ul className="space-y-2 ml-4">
              <li className="flex gap-2">
                <span className="text-[#f7931a]">•</span>
                <span>
                  <a href="https://btcpayserver.org" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                    BTCPay Server
                  </a>
                  {' '}— free, self-hosted payment processor
                </span>
              </li>
              <li className="flex gap-2">
                <span className="text-[#f7931a]">•</span>
                <span>
                  <a href="https://btcmap.org" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                    BTCMap
                  </a>
                  {' '}— map of Bitcoin-accepting businesses worldwide
                </span>
              </li>
              <li className="flex gap-2">
                <span className="text-[#f7931a]">•</span>
                <span>
                  <a href="https://strike.me/business" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                    Strike for Business
                  </a>
                  {' '}— easy Lightning payments, instant USD conversion
                </span>
              </li>
              <li className="flex gap-2">
                <span className="text-[#f7931a]">•</span>
                <span>
                  <a href="https://zaprite.com" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                    Zaprite
                  </a>
                  {' '}— Bitcoin invoicing and payments for businesses
                </span>
              </li>
            </ul>
          </div>
        </section>

        {/* Remember */}
        <section className="mb-10">
          <h2 className="font-bold text-lg mb-3 border-b border-[var(--border)] pb-2 flex items-center gap-2">
            <Plant size={20} weight="fill" className="text-green-600" /> remember
          </h2>
          <div className="space-y-3 text-[var(--fg-muted)]">
            <ul className="space-y-2">
              <li className="flex gap-2">
                <span className="text-[var(--fg-faint)]">→</span>
                <span>one conversation plants a seed</span>
              </li>
              <li className="flex gap-2">
                <span className="text-[var(--fg-faint)]">→</span>
                <span>not every seed grows immediately</span>
              </li>
              <li className="flex gap-2">
                <span className="text-[var(--fg-faint)]">→</span>
                <span>be patient, be kind, come back another day</span>
              </li>
              <li className="flex gap-2">
                <span className="text-[var(--fg-faint)]">→</span>
                <span>coordinated orange-pilling, not harassment</span>
              </li>
              <li className="flex gap-2">
                <span className="text-[var(--fg-faint)]">→</span>
                <span>helpful tips, not pressure tactics</span>
              </li>
            </ul>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-[var(--border)] mt-8">
        <div className="max-w-2xl mx-auto px-8 py-6 flex flex-wrap justify-center gap-x-3 sm:gap-x-6 gap-y-2 text-xs text-faint">
          <a href="/?view=nearby" className="hover:text-[var(--fg-muted)] transition-colors">nearby</a>
          <a href="/map" className="hover:text-[var(--fg-muted)] transition-colors">map</a>
          <a href="/merchant" className="hover:text-[var(--fg-muted)] transition-colors">merchants</a>
          <a href="/advocacy" className="hover:text-[var(--fg-muted)] transition-colors font-medium text-[var(--fg)]">advocacy</a>
          <a href="/about" className="hover:text-[var(--fg-muted)] transition-colors">about</a>
          <a href="/terms" className="hover:text-[var(--fg-muted)] transition-colors">terms</a>
          <a href="/privacy" className="hover:text-[var(--fg-muted)] transition-colors">privacy</a>
        </div>
      </footer>
    </div>
  );
}
