// src/pages/PrivacyPage.jsx
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

export default function PrivacyPage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-dvh" style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
      <header
        className="sticky top-0 z-10 flex items-center gap-3 px-4 h-14"
        style={{ background: 'var(--bg-primary)', borderBottom: '1px solid var(--border-color)' }}
      >
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-xl" style={{ color: 'var(--text-secondary)' }}>
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-sm font-bold">Privacy Policy</h1>
      </header>

      <div className="mx-auto max-w-2xl px-5 py-8 space-y-8" style={{ color: 'var(--text-secondary)', lineHeight: 1.75 }}>

        <div>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Last updated: June 2025</p>
          <p className="mt-3 text-sm">
            This Privacy Policy describes how Meckury AI ("we", "us", or "our") collects, uses, and protects
            your information when you use our AI content generation platform at meckury.ai ("the Platform").
          </p>
        </div>

        <section>
          <h2 className="text-base font-bold mb-2" style={{ color: 'var(--text-primary)' }}>1. Age Requirement</h2>
          <p className="text-sm">
            Meckury AI is strictly for users who are 18 years of age or older. By accessing or using the Platform,
            you confirm that you are at least 18 years old. We do not knowingly collect personal information from
            minors. If we become aware that a user is under 18, their account will be terminated immediately.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold mb-2" style={{ color: 'var(--text-primary)' }}>2. Information We Collect</h2>
          <p className="text-sm">We collect the following information when you use Meckury AI:</p>
          <ul className="mt-2 text-sm space-y-1 list-disc list-inside" style={{ color: 'var(--text-muted)' }}>
            <li>Account information (name, email address) provided during registration or Google sign-in</li>
            <li>Content you upload or generate on the Platform (images, videos, audio, prompts)</li>
            <li>Usage data such as features accessed, generation history, and credit transactions</li>
            <li>Device and browser information for security and analytics purposes</li>
            <li>Payment information processed securely through Paystack (we do not store card details)</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-bold mb-2" style={{ color: 'var(--text-primary)' }}>3. How We Use Your Information</h2>
          <ul className="mt-2 text-sm space-y-1 list-disc list-inside" style={{ color: 'var(--text-muted)' }}>
            <li>To provide, maintain, and improve the Platform</li>
            <li>To process credit purchases and manage your account balance</li>
            <li>To store and serve your generated content</li>
            <li>To send important account and service notifications</li>
            <li>To detect and prevent fraud, abuse, or violations of our Terms</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-bold mb-2" style={{ color: 'var(--text-primary)' }}>4. Third-Party Services</h2>
          <p className="text-sm">
            Meckury AI integrates with third-party AI providers (including but not limited to WaveSpeed, fal.ai,
            and ElevenLabs) to process generation requests. Content submitted for generation may be processed
            by these providers in accordance with their own privacy policies. We also use Supabase for data
            storage and authentication, Paystack for payment processing, and Vercel for hosting.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold mb-2" style={{ color: 'var(--text-primary)' }}>5. Data Retention</h2>
          <p className="text-sm">
            We retain your account data and generated content for as long as your account remains active.
            You may request deletion of your account and associated data at any time by contacting us at
            meckurypro@gmail.com. Some data may be retained for legal or security purposes.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold mb-2" style={{ color: 'var(--text-primary)' }}>6. Data Security</h2>
          <p className="text-sm">
            We implement industry-standard security measures to protect your data. However, no method of
            transmission over the internet is 100% secure. You use the Platform at your own risk and are
            responsible for maintaining the confidentiality of your account credentials.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold mb-2" style={{ color: 'var(--text-primary)' }}>7. Cookies</h2>
          <p className="text-sm">
            We use cookies and similar technologies to maintain your session and improve your experience.
            By using the Platform, you consent to our use of cookies.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold mb-2" style={{ color: 'var(--text-primary)' }}>8. Changes to This Policy</h2>
          <p className="text-sm">
            We may update this Privacy Policy from time to time. Continued use of the Platform after changes
            are posted constitutes your acceptance of the updated policy.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold mb-2" style={{ color: 'var(--text-primary)' }}>9. Contact</h2>
          <p className="text-sm">
            For privacy-related questions, contact us at{' '}
            <a href="mailto:hey@meckury.ai" className="underline" style={{ color: 'var(--brand)' }}>
              hey@meckury.ai
            </a>.
          </p>
        </section>

      </div>
    </div>
  )
}
