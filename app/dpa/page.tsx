export default function DpaPage() {
  return (
    <main style={{ maxWidth: 860, margin: "0 auto", padding: "48px 20px" }}>
      <h1>Data Processing Addendum (DPA)</h1>
      <p><strong>Last updated:</strong> {new Date().toISOString().slice(0, 10)}</p>

      <h2>Parties</h2>
      <p>
        This DPA is between the customer (“Controller”) and CP Hours (“Processor”),
        and applies when CP Hours processes personal data on behalf of the Controller.
      </p>

      <h2>Subject matter and duration</h2>
      <p>
        CP Hours processes personal data to provide the hours registration service.
        Processing continues for the duration of the customer’s use of the Service.
      </p>

      <h2>Nature and purpose of processing</h2>
      <ul>
        <li>Authentication and access control</li>
        <li>Hour entry submission, review, approval/rejection</li>
        <li>Audit logging for accountability and security</li>
        <li>Operational troubleshooting and security monitoring</li>
      </ul>

      <h2>Types of personal data</h2>
      <ul>
        <li>Employee identifiers: name, email, role, company membership</li>
        <li>Work data: dates, times, breaks, status, rejection reason</li>
        <li>Security/technical data: session identifiers, timestamps, IP/user-agent (if stored)</li>
      </ul>

      <h2>Categories of data subjects</h2>
      <ul>
        <li>Customer employees</li>
        <li>Customer administrators</li>
      </ul>

      <h2>Processor obligations</h2>
      <ul>
        <li>Process data only on documented instructions from the Controller.</li>
        <li>Ensure confidentiality for personnel with access to personal data.</li>
        <li>Implement appropriate security measures.</li>
        <li>Assist with data subject requests where applicable.</li>
        <li>Notify the Controller of personal data breaches without undue delay.</li>
      </ul>

      <h2>Subprocessors</h2>
      <p>
        CP Hours may use subprocessors for hosting and database services. CP Hours
        remains responsible for subprocessors’ performance of their obligations.
      </p>

      <h2>International transfers</h2>
      <p>
        The Service is intended for EU-region hosting (V1). If transfers outside the EU/EEA occur,
        appropriate safeguards will be used as required by law.
      </p>

      <h2>Security measures</h2>
      <ul>
        <li>Tenant isolation enforced server-side</li>
        <li>Server-side sessions with HttpOnly cookies</li>
        <li>Access control by role</li>
        <li>Audit logging for key mutations</li>
        <li>Rate limiting and standardized error handling for public endpoints</li>
      </ul>

      <h2>Deletion and return of data</h2>
      <p>
        Upon termination, the Controller may request export and/or deletion of customer data
        within a reasonable time, unless retention is required by law.
      </p>

      <h2>Contact</h2>
      <p>
        DPA requests: <strong>[ADD CONTACT EMAIL]</strong>
      </p>
    </main>
  );
}
