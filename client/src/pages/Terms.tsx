import { Link } from "wouter";
import { ArrowLeft, FileText } from "lucide-react";

export default function Terms() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-6 py-12">
        <Link href="/">
          <a className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-8">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </a>
        </Link>

        <div className="flex items-center gap-3 mb-8">
          <FileText className="w-8 h-8 text-primary" />
          <h1 className="text-3xl font-bold">Terms of Service</h1>
        </div>

        <p className="text-muted-foreground mb-8">
          Last updated: March 26, 2026
        </p>

        <div className="prose dark:prose-invert max-w-none space-y-8">
          <section>
            <h2 className="text-xl font-semibold mt-6 mb-3">1. Acceptance of Terms</h2>
            <p className="text-muted-foreground leading-relaxed">
              By accessing or using MediApp ("the Service"), you agree to be bound by these Terms of Service.
              If you are using the Service on behalf of an organization, you represent that you have authority
              to bind that organization to these terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-6 mb-3">2. Description of Service</h2>
            <p className="text-muted-foreground leading-relaxed">
              MediApp provides a Medicare plan comparison and management platform for licensed insurance agents,
              agencies, and healthcare organizations. The Service includes plan data analysis, client management,
              recommendation engines, market intelligence, and compliance tools. The Service uses data from the
              Centers for Medicare & Medicaid Services (CMS) and other publicly available sources.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-6 mb-3">3. Account Registration</h2>
            <p className="text-muted-foreground leading-relaxed">
              You must provide accurate, current, and complete registration information. You are responsible
              for maintaining the confidentiality of your account credentials. You must notify us immediately
              of any unauthorized use of your account. Accounts are subject to:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li>Password requirements: minimum 12 characters with uppercase, lowercase, number, and special character</li>
              <li>Session management: sessions expire after 24 hours of inactivity</li>
              <li>Account lockout: 5 failed login attempts results in a 15-minute lockout</li>
              <li>Maximum 5 concurrent sessions per user</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-6 mb-3">4. Acceptable Use</h2>
            <p className="text-muted-foreground leading-relaxed">You agree not to:</p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li>Use the Service for any unlawful purpose</li>
              <li>Attempt to gain unauthorized access to the Service or other users' accounts</li>
              <li>Share your account credentials with unauthorized individuals</li>
              <li>Scrape, crawl, or use automated means to access the Service beyond approved API usage</li>
              <li>Upload malicious code or content</li>
              <li>Use client PHI data for purposes other than authorized insurance-related activities</li>
              <li>Circumvent security controls, rate limits, or access restrictions</li>
              <li>Misrepresent plan information to consumers</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-6 mb-3">5. Data and PHI Handling</h2>
            <p className="text-muted-foreground leading-relaxed">
              You acknowledge that client data entered into the Service may constitute Protected Health
              Information (PHI) under HIPAA. You agree to:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li>Only enter client data with proper authorization and consent</li>
              <li>Comply with all applicable HIPAA regulations regarding PHI</li>
              <li>Maintain appropriate Scope of Appointment (SOA) documentation</li>
              <li>Not export or share PHI outside of authorized business purposes</li>
              <li>Report any suspected data breach immediately</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-6 mb-3">6. API Access (Enterprise)</h2>
            <p className="text-muted-foreground leading-relaxed">
              Enterprise customers with API access agree to: keep API keys confidential, implement
              appropriate security measures in their integrations, not exceed rate limits, and comply
              with all data handling requirements. API keys can be revoked at any time for misuse.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-6 mb-3">7. Audit and Compliance</h2>
            <p className="text-muted-foreground leading-relaxed">
              All actions on the platform are subject to audit logging for SOC2 Type II compliance.
              Audit logs are immutable and retained for a minimum of 7 years. Users with admin or
              compliance roles may access audit reports. We may conduct periodic security reviews
              and reserve the right to suspend accounts that pose security risks.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-6 mb-3">8. Intellectual Property</h2>
            <p className="text-muted-foreground leading-relaxed">
              The Service, including its algorithms, market intelligence models, and analytical tools,
              is our proprietary property. Plan data sourced from CMS is public domain. Analyses,
              recommendations, and insights generated by the platform are provided for informational
              purposes to support your professional judgment.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-6 mb-3">9. Disclaimers</h2>
            <p className="text-muted-foreground leading-relaxed">
              The Service provides plan comparison tools and is not a substitute for professional
              insurance advice. Plan details, premiums, and benefits are sourced from CMS and carrier
              data and may change. We strive for accuracy but do not guarantee that all plan information
              is current or error-free. Always verify plan details with the carrier before enrollment.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-6 mb-3">10. Limitation of Liability</h2>
            <p className="text-muted-foreground leading-relaxed">
              To the maximum extent permitted by law, we shall not be liable for indirect, incidental,
              special, consequential, or punitive damages arising from your use of the Service. Our total
              liability shall not exceed the fees paid by you in the 12 months preceding the claim.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-6 mb-3">11. Termination</h2>
            <p className="text-muted-foreground leading-relaxed">
              We may suspend or terminate your account for violations of these terms, security concerns,
              or non-payment. Upon termination, your right to access the Service ceases. Data retention
              after termination is governed by our Privacy Policy and applicable regulations.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-6 mb-3">12. Changes to Terms</h2>
            <p className="text-muted-foreground leading-relaxed">
              We may update these terms from time to time. Material changes will be communicated via
              email or in-app notification. Continued use of the Service after changes constitutes
              acceptance of the updated terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-6 mb-3">13. Contact</h2>
            <p className="text-muted-foreground leading-relaxed">
              For questions about these terms, contact: legal@mediapp.com
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
