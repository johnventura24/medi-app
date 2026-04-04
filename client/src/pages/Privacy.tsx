import { Link } from "wouter";
import { ArrowLeft, Shield } from "lucide-react";

export default function Privacy() {
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
          <Shield className="w-8 h-8 text-primary" />
          <h1 className="text-3xl font-bold">Privacy Policy</h1>
        </div>

        <p className="text-muted-foreground mb-8">
          Last updated: March 26, 2026
        </p>

        <div className="prose dark:prose-invert max-w-none space-y-8">
          <section>
            <h2 className="text-xl font-semibold mt-6 mb-3">1. Introduction</h2>
            <p className="text-muted-foreground leading-relaxed">
              Prism ("we," "us," or "our") is committed to protecting the privacy and security of your personal
              information. This Privacy Policy describes how we collect, use, disclose, and safeguard your information
              when you use our Medicare plan comparison and management platform. We are designed to be compliant with
              HIPAA, SOC2 Type II, and applicable state and federal privacy regulations.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-6 mb-3">2. Information We Collect</h2>
            <h3 className="text-lg font-medium mt-4 mb-2">2.1 Account Information</h3>
            <p className="text-muted-foreground leading-relaxed">
              When you create an account, we collect your email address, full name, organization name,
              National Producer Number (NPN) for licensed agents, and account credentials. Passwords are
              hashed using scrypt with unique salts and are never stored in plaintext.
            </p>

            <h3 className="text-lg font-medium mt-4 mb-2">2.2 Client Data (Protected Health Information)</h3>
            <p className="text-muted-foreground leading-relaxed">
              When agents enter client information for plan matching, we may collect: names, dates of birth,
              ZIP codes, chronic conditions, current medications, preferred doctors, and coverage preferences.
              This data is classified as Protected Health Information (PHI) and is encrypted at rest using
              AES-256-GCM encryption. Access to PHI is logged and audited.
            </p>

            <h3 className="text-lg font-medium mt-4 mb-2">2.3 Usage Data</h3>
            <p className="text-muted-foreground leading-relaxed">
              We collect information about how you use the platform, including pages visited, searches performed,
              plans compared, exports generated, and feature interactions. This data is used to improve the
              platform and for security monitoring.
            </p>

            <h3 className="text-lg font-medium mt-4 mb-2">2.4 Technical Data</h3>
            <p className="text-muted-foreground leading-relaxed">
              We automatically collect IP addresses, browser type, device information, and access timestamps
              for security monitoring and audit compliance.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-6 mb-3">3. How We Use Your Information</h2>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li>Providing Medicare plan comparison and recommendation services</li>
              <li>Matching clients with appropriate insurance plans based on their health needs</li>
              <li>Generating exports, reports, and scope of appointment documents</li>
              <li>Maintaining audit trails for regulatory compliance (SOC2, HIPAA)</li>
              <li>Detecting and preventing unauthorized access or security incidents</li>
              <li>Improving platform functionality and user experience</li>
              <li>Communicating service updates and security notifications</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-6 mb-3">4. Data Security</h2>
            <p className="text-muted-foreground leading-relaxed">
              We implement enterprise-grade security measures including:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li><strong>Encryption at rest:</strong> All PHI is encrypted using AES-256-GCM with unique initialization vectors</li>
              <li><strong>Encryption in transit:</strong> All data is transmitted over TLS 1.2+</li>
              <li><strong>Access controls:</strong> Role-based access control (RBAC) with admin, compliance, agent, and viewer roles</li>
              <li><strong>Audit logging:</strong> All access to sensitive data is logged with timestamps, user identity, and IP addresses</li>
              <li><strong>Session management:</strong> 24-hour session expiration, maximum 5 concurrent sessions per user</li>
              <li><strong>Password policy:</strong> Minimum 12 characters with complexity requirements, 5-attempt lockout</li>
              <li><strong>Rate limiting:</strong> API rate limiting to prevent abuse</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-6 mb-3">5. Data Retention</h2>
            <p className="text-muted-foreground leading-relaxed">
              Account data is retained for the duration of your account plus 90 days after deletion.
              Client PHI data is retained per the agent's organization policy and applicable regulations.
              Audit logs are retained for a minimum of 7 years for SOC2 compliance.
              Export logs and session data are retained for 1 year.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-6 mb-3">6. Data Sharing</h2>
            <p className="text-muted-foreground leading-relaxed">
              We do not sell personal information. We may share data with: infrastructure providers
              (hosting, database) under strict data processing agreements; law enforcement when required
              by law; and your organization's administrators for compliance purposes.
              Plan data sourced from CMS is public information.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-6 mb-3">7. Your Rights</h2>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li><strong>Access:</strong> Request a copy of your personal data</li>
              <li><strong>Correction:</strong> Request correction of inaccurate data</li>
              <li><strong>Deletion:</strong> Request deletion of your account and associated data</li>
              <li><strong>Export:</strong> Request an export of your data in a portable format</li>
              <li><strong>Restrict processing:</strong> Request limitation of data processing</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-3">
              To exercise these rights, contact your organization administrator or our privacy team.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-6 mb-3">8. HIPAA Compliance</h2>
            <p className="text-muted-foreground leading-relaxed">
              For covered entities and business associates, we execute Business Associate Agreements (BAAs)
              as required by HIPAA. We implement administrative, physical, and technical safeguards
              to protect PHI in accordance with the HIPAA Security Rule.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-6 mb-3">9. Contact</h2>
            <p className="text-muted-foreground leading-relaxed">
              For privacy-related inquiries, contact: privacy@mediapp.com
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
