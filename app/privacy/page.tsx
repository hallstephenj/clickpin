'use client';

import Link from 'next/link';
import { Lightning } from '@phosphor-icons/react';

export default function PrivacyPage() {
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
        <h1 className="text-2xl font-bold mb-2">Privacy Policy</h1>
        <p className="text-sm text-[var(--fg-muted)] font-mono mb-8">
          Effective Date: January 7, 2026
        </p>

        <div className="prose prose-sm dark:prose-invert max-w-none space-y-6 text-[var(--fg-muted)]">
          <p>
            Clickpin is designed to minimize data collection and maximize user privacy.
            This Privacy Policy explains what information we collect, how we use it,
            and your choices.
          </p>

          <section>
            <h2 className="text-lg font-bold text-[var(--fg)] mt-8 mb-3">1. Information We Collect</h2>
            <p><strong>We collect only what is necessary to operate the service.</strong></p>

            <p className="mt-4">Information collected includes:</p>
            <ul className="list-disc ml-6 space-y-2">
              <li>Randomly generated device session identifiers (UUIDs)</li>
              <li>User-generated content (posts, replies, drawings)</li>
              <li>Flag records and moderation metadata</li>
              <li>Payment records and Lightning invoices</li>
              <li>Sponsorship and feature usage records</li>
            </ul>

            <p className="mt-4">We do not collect:</p>
            <ul className="list-disc ml-6 space-y-2">
              <li>Names, emails, phone numbers, or account credentials</li>
              <li>Persistent location history</li>
              <li>Government-issued identifiers</li>
              <li>Browser fingerprinting data</li>
              <li>Advertising or analytics identifiers</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[var(--fg)] mt-8 mb-3">2. Location Data</h2>
            <p>
              Geolocation data is used only to verify physical presence at a location.
              Coordinates are processed in memory and discarded immediately after
              verification. Location data is not stored in the database.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[var(--fg)] mt-8 mb-3">3. Payments</h2>
            <p>
              Payments are processed via third-party Bitcoin Lightning Network providers.
              Clickpin does not receive personal identity information from these providers.
            </p>
            <p>
              Payment metadata may be retained for accounting, fraud prevention, and
              legal compliance purposes.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[var(--fg)] mt-8 mb-3">4. Cookies and Tracking</h2>
            <p>
              Clickpin does not use advertising cookies, third-party trackers, or
              analytics scripts. Limited local storage is used to maintain device
              sessions and application state.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[var(--fg)] mt-8 mb-3">5. How We Use Information</h2>
            <p>We use collected information solely to:</p>
            <ul className="list-disc ml-6 space-y-2">
              <li>Operate and maintain the service</li>
              <li>Enforce posting limits and abuse prevention</li>
              <li>Enable optional paid features</li>
              <li>Moderate content</li>
              <li>Comply with legal obligations</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[var(--fg)] mt-8 mb-3">6. Data Retention</h2>
            <p>
              Content and related metadata may be retained indefinitely unless removed
              or anonymized. Soft-deleted posts may be preserved for legal or operational
              reasons.
            </p>
            <p>
              Device session identifiers persist until cleared by the user.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[var(--fg)] mt-8 mb-3">7. Data Security</h2>
            <p>
              We employ reasonable administrative, technical, and organizational measures
              to protect data, including:
            </p>
            <ul className="list-disc ml-6 space-y-2">
              <li>Cryptographically signed presence tokens</li>
              <li>Database row-level security</li>
              <li>Access controls for administrative interfaces</li>
            </ul>
            <p>
              No system is perfectly secure, and we cannot guarantee absolute security.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[var(--fg)] mt-8 mb-3">8. Third-Party Services</h2>
            <p>
              Clickpin relies on infrastructure and payment providers to operate.
              These providers process data according to their own privacy policies.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[var(--fg)] mt-8 mb-3">9. User Rights</h2>
            <p>
              Because Clickpin does not collect personal identifying information, many
              traditional data access or deletion rights may not apply. Users may clear
              their device session at any time by clearing browser storage.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[var(--fg)] mt-8 mb-3">10. Children's Privacy</h2>
            <p>
              Clickpin is not intended for use by individuals under 18 years of age.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[var(--fg)] mt-8 mb-3">11. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy periodically. Continued use of Clickpin
              constitutes acceptance of any changes.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[var(--fg)] mt-8 mb-3">12. Contact</h2>
            <p>
              For privacy-related inquiries, contact:{' '}
              <a href="mailto:hello@clickpin.io" className="text-[var(--accent)] hover:underline">
                hello@clickpin.io
              </a>
            </p>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[var(--border)] mt-8">
        <div className="max-w-2xl mx-auto px-4 py-6 flex justify-center gap-6 text-xs text-faint">
          <a href="/?view=nearby" className="hover:text-[var(--fg-muted)] transition-colors">nearby</a>
          <a href="/map" className="hover:text-[var(--fg-muted)] transition-colors">map</a>
          <a href="/merchant" className="hover:text-[var(--fg-muted)] transition-colors">merchants</a>
          <a href="/about" className="hover:text-[var(--fg-muted)] transition-colors">about</a>
          <a href="/terms" className="hover:text-[var(--fg-muted)] transition-colors">terms</a>
          <a href="/privacy" className="hover:text-[var(--fg-muted)] transition-colors">privacy</a>
        </div>
      </footer>
    </div>
  );
}
