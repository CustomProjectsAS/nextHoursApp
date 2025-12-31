export default function PrivacyPage() {
  return (
    <main style={{ maxWidth: 860, margin: "0 auto", padding: "48px 20px" }}>
      <h1>Privacy Policy</h1>
      <p><strong>Last updated:</strong> {new Date().toISOString().slice(0, 10)}</p>

      <h2>Who we are</h2>
      <p>
        CP Hours (“we”, “us”) provides a work hours registration service for
        companies. This Privacy Policy explains how we process personal data
        when you use CP Hours.
      </p>

      <h2>What data we process</h2>
      <ul>
        <li><strong>Account data:</strong> email, name, role, company membership.</li>
        <li><strong>Work entries:</strong> work date, from/to time, break minutes, status, rejection reason.</li>
        <li><strong>Audit logs:</strong> events about changes (who changed what and when).</li>
        <li><strong>Security data:</strong> session identifiers, IP/user-agent (if stored), timestamps.</li>
      </ul>

      <h2>Why we process data</h2>
      <ul>
        <li>To provide the service (authentication, tenant access, hour registration and approvals).</li>
        <li>To keep the service secure (sessions, abuse prevention, investigation).</li>
        <li>To maintain an audit trail for accountability (admin/employee changes).</li>
        <li>To operate and improve the service (reliability and troubleshooting).</li>
      </ul>

      <h2>Legal basis</h2>
      <p>
        For business customers, processing is typically necessary to perform the
        contract and to meet legitimate interests in operating a secure,
        auditable hours system. The customer is usually the data controller for
        employee data, and CP Hours acts as a processor.
      </p>

      <h2>Data sharing</h2>
      <p>
        We do not sell personal data. We share data only with service providers
        needed to run CP Hours (for example: hosting and database providers),
        and only to the extent required to provide the service.
      </p>

      <h2>Data retention</h2>
      <p>
        We retain personal data as long as needed to provide the service and
        meet legitimate operational needs (such as auditability and security),
        unless a longer retention period is required by law or agreed with the customer.
      </p>

      <h2>Security</h2>
      <p>
        We use reasonable technical and organizational measures to protect data,
        including tenant isolation, server-side sessions, and audit logging for
        key actions.
      </p>

      <h2>Your rights</h2>
      <p>
        If you are an employee using CP Hours through your employer, please
        contact your employer first. If you are a customer admin, you can
        contact us to request access, correction, export, or deletion where applicable.
      </p>

      <h2>Contact</h2>
      <p>
        Contact us for privacy requests: <strong>[ADD CONTACT EMAIL]</strong>
      </p>
    </main>
  );
}
