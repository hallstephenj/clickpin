import Link from 'next/link';

export default function TermsPage() {
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
        <h1 className="text-2xl font-bold mb-2">Terms of Service</h1>
        <p className="text-sm text-[var(--fg-muted)] font-mono mb-8">
          Effective Date: January 7, 2026
        </p>

        <div className="prose prose-sm dark:prose-invert max-w-none space-y-6 text-[var(--fg-muted)]">
          <p>
            These Terms of Service ("Terms") govern your access to and use of Clickpin
            ("Clickpin," "we," "us," or "our"), an anonymous, location-gated message board
            platform accessible via the web application.
          </p>
          <p>
            By accessing or using Clickpin, you agree to be bound by these Terms. If you
            do not agree, do not use the service.
          </p>

          <section>
            <h2 className="text-lg font-bold text-[var(--fg)] mt-8 mb-3">1. Description of the Service</h2>
            <p>
              Clickpin is a location-based message board platform that allows users to view
              and post content ("pins") only when physically present within defined geographic
              boundaries. The platform supports optional micropayments via the Bitcoin Lightning
              Network for certain features.
            </p>
            <p>
              Clickpin is provided on an "as-is" and "as-available" basis. We may modify,
              suspend, or discontinue any part of the service at any time.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[var(--fg)] mt-8 mb-3">2. Eligibility</h2>
            <p>
              You must be at least 18 years old, or the age of majority in your jurisdiction,
              to use Clickpin. By using the service, you represent that you meet this requirement.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[var(--fg)] mt-8 mb-3">3. Anonymous Use and Device Sessions</h2>
            <p>
              Clickpin does not require user accounts or personal identification. Instead, your
              device is assigned a randomly generated identifier stored locally in your browser
              ("device session ID").
            </p>
            <p>You understand and agree that:</p>
            <ul className="list-disc ml-6 space-y-2">
              <li>Clearing browser storage will reset your device session and sever any association with prior posts.</li>
              <li>Device session IDs are used solely for operational purposes such as rate limiting, post ownership, and abuse prevention.</li>
              <li>Clickpin does not guarantee recovery of posts or privileges if your device session is lost.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[var(--fg)] mt-8 mb-3">4. Location Verification</h2>
            <p>
              Access to content requires granting geolocation permission through your browser.
              Location data is verified transiently to confirm presence within a defined boundary
              and is not stored by Clickpin.
            </p>
            <p>
              If you deny or spoof location data, certain features may be unavailable or restricted.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[var(--fg)] mt-8 mb-3">5. User Content</h2>
            <p>
              You are solely responsible for any content you post, including text, drawings,
              replies, and sponsorship identifiers.
            </p>
            <p>You agree not to post content that:</p>
            <ul className="list-disc ml-6 space-y-2">
              <li>Is unlawful, threatening, abusive, defamatory, obscene, or fraudulent</li>
              <li>Violates intellectual property rights</li>
              <li>Encourages violence or illegal activity</li>
              <li>Is intended to harass or impersonate others</li>
            </ul>
            <p>
              Clickpin does not pre-screen content. We reserve the right to remove, hide, or
              restrict content at our discretion, including through automated or community-driven
              mechanisms.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[var(--fg)] mt-8 mb-3">6. Community Moderation</h2>
            <p>
              Clickpin uses a community flagging system. Posts receiving a sufficient number of
              flags may be automatically hidden. Administrators may intervene manually.
            </p>
            <p>
              You acknowledge that moderation decisions may be imperfect and agree that Clickpin
              is not responsible for user-generated content or moderation outcomes.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[var(--fg)] mt-8 mb-3">7. Payments and Lightning Network Transactions</h2>
            <p>
              Certain features require optional payment via the Bitcoin Lightning Network.
              All payments are:
            </p>
            <ul className="list-disc ml-6 space-y-2">
              <li>Voluntary</li>
              <li>Non-refundable, except at our sole discretion</li>
              <li>Payments for digital services, not stored value or transferable balances</li>
            </ul>
            <p>
              Clickpin does not facilitate peer-to-peer transfers, custody funds on behalf of
              users, or provide withdrawal functionality.
            </p>
            <p>
              Payment processing is handled through third-party Lightning providers. Clickpin
              is not responsible for payment failures, routing issues, or provider outages.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[var(--fg)] mt-8 mb-3">8. Sponsorships and Visibility</h2>
            <p>
              Sponsorships, boosts, and paid placements affect content ordering and visibility
              but do not guarantee engagement, traffic, or outcomes.
            </p>
            <p>
              We reserve the right to reject, remove, or terminate sponsorships at any time,
              including for policy violations.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[var(--fg)] mt-8 mb-3">9. Intellectual Property</h2>
            <p>
              The Clickpin platform, including its software, design, and branding, is owned by
              Clickpin and protected by applicable intellectual property laws.
            </p>
            <p>
              You retain ownership of your content but grant Clickpin a non-exclusive, worldwide,
              royalty-free license to host, display, and distribute it solely for the operation
              of the service.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[var(--fg)] mt-8 mb-3">10. Disclaimer of Warranties</h2>
            <p>
              Clickpin is provided "as is" without warranties of any kind. We do not guarantee
              uninterrupted service, error-free operation, or the accuracy of content.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[var(--fg)] mt-8 mb-3">11. Limitation of Liability</h2>
            <p>
              To the maximum extent permitted by law, Clickpin shall not be liable for any
              indirect, incidental, consequential, or punitive damages arising from your use
              of the service.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[var(--fg)] mt-8 mb-3">12. Indemnification</h2>
            <p>
              You agree to indemnify and hold harmless Clickpin from any claims, liabilities,
              or expenses arising from your use of the service or violation of these Terms.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[var(--fg)] mt-8 mb-3">13. Governing Law</h2>
            <p>
              These Terms are governed by the laws of the State of Delaware, without regard
              to conflict-of-law principles.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[var(--fg)] mt-8 mb-3">14. Changes to These Terms</h2>
            <p>
              We may update these Terms from time to time. Continued use of Clickpin after
              changes constitutes acceptance of the revised Terms.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[var(--fg)] mt-8 mb-3">15. Contact</h2>
            <p>
              For questions or legal inquiries, contact:{' '}
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
          <a href="/about" className="hover:text-[var(--fg-muted)] transition-colors">about</a>
          <a href="/terms" className="hover:text-[var(--fg-muted)] transition-colors">terms</a>
          <a href="/privacy" className="hover:text-[var(--fg-muted)] transition-colors">privacy</a>
        </div>
      </footer>
    </div>
  );
}
