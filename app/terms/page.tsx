export default function TermsPage() {
  return (
    <main style={{ maxWidth: 860, margin: "0 auto", padding: "48px 20px" }}>
      <h1>Terms of Service</h1>
      <p><strong>Last updated:</strong> {new Date().toISOString().slice(0, 10)}</p>

      <h2>Service</h2>
      <p>
        CP Hours provides a software service for registering, reviewing, and
        managing work hours for companies (“the Service”).
      </p>

      <h2>Who may use the Service</h2>
      <p>
        The Service is intended for business use. Accounts are created and
        managed by customer administrators. Employees use the Service under
        their employer’s responsibility.
      </p>

      <h2>Customer responsibilities</h2>
      <ul>
        <li>Ensure that use of the Service complies with applicable laws and regulations.</li>
        <li>Ensure that employee data entered into the Service is lawful and accurate.</li>
        <li>Protect access credentials and prevent unauthorized use.</li>
      </ul>

      <h2>Availability</h2>
      <p>
        We aim to keep the Service available and reliable, but we do not guarantee
        uninterrupted operation. Maintenance, updates, or incidents may cause
        temporary downtime.
      </p>

      <h2>Data and ownership</h2>
      <p>
        Customer data remains owned by the customer. CP Hours processes data
        only to provide the Service, in accordance with the Privacy Policy and
        applicable data protection agreements.
      </p>

      <h2>Limitations of liability</h2>
      <p>
        To the maximum extent permitted by law, CP Hours is not liable for
        indirect, incidental, or consequential damages arising from use of
        the Service.
      </p>

      <h2>Termination</h2>
      <p>
        Customers may stop using the Service at any time. We may suspend or
        terminate access in cases of misuse, security risk, or legal requirement.
      </p>

      <h2>Changes</h2>
      <p>
        We may update these Terms from time to time. Continued use of the Service
        after changes means acceptance of the updated Terms.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about these Terms: <strong>[ADD CONTACT EMAIL]</strong>
      </p>
    </main>
  );
}
