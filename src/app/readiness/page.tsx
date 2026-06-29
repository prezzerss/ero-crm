const wiringSteps = [
  {
    title: "1. Confirm data model",
    status: "In place",
    detail:
      "Clients, contacts, tags, contact tags, mailing status, and inbound emails have matching screens and SQL.",
  },
  {
    title: "2. Stage inbox data",
    status: "Ready",
    detail:
      "projects@, quotes@, and enquiries@ can all land in inbound_emails before anyone links or stores them as contacts.",
  },
  {
    title: "3. Review before saving",
    status: "Ready",
    detail:
      "The team can inspect each email, link it to a client/contact, create a contact, add notes, or ignore it.",
  },
  {
    title: "4. Automate carefully",
    status: "Next",
    detail:
      "Only after the review workflow is approved should mailbox sync, parsing, duplicate matching, and reporting be automated.",
  },
];

const dataSurfaces = [
  "clients",
  "contacts",
  "tags",
  "contact_tags",
  "inbound_emails",
  "mailing_status",
  "source_inbox",
  "future jobs and quotes",
];

const internalNotes = [
  "The CRM can be shown now without live mailbox access.",
  "Email wiring will feed into the existing review queue, not a separate workflow.",
  "Mailing list rules are visible before any export or campaign tool is connected.",
  "The team can approve data fields and tags before automation starts.",
];

export default function ReadinessPage() {
  return (
    <div className="grid gap-8">
      <header>
        <h1 className="crm-page-title">Wiring plan</h1>
        <p className="crm-muted mt-2 max-w-3xl">
          The app is shaped so inbox sync, contact matching, mailing exports, and reporting can be
          wired into the same screens instead of redesigned later.
        </p>
      </header>

      <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="crm-card p-6">
          <h2 className="crm-section-title">Integration sequence</h2>
          <div className="mt-5 grid gap-5">
            {wiringSteps.map((step) => (
              <div className="flex gap-4" key={step.title}>
                <div className="crm-workflow-line" />
                <div>
                  <p className="font-black">
                    {step.title} <span className="crm-status-pill ml-2">{step.status}</span>
                  </p>
                  <p className="crm-muted mt-1">{step.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="crm-panel-tint p-6">
          <h2 className="crm-section-title">Internal notes</h2>
          <div className="mt-5 grid gap-3">
            {internalNotes.map((point) => (
              <div className="crm-panel p-4" key={point}>
                <p className="font-bold">{point}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
        <div className="crm-card p-6">
          <h2 className="crm-section-title">Data surfaces already represented</h2>
          <div className="mt-5 flex flex-wrap gap-2">
            {dataSurfaces.map((surface) => (
              <span className="crm-status-pill" key={surface}>
                {surface}
              </span>
            ))}
          </div>
        </div>

        <div className="crm-card overflow-hidden">
          <div className="border-b border-[var(--border-soft)] p-5">
            <h2 className="crm-section-title">What wiring needs later</h2>
            <p className="crm-muted mt-1">These are implementation tasks, not design gaps.</p>
          </div>

          <table className="crm-table">
            <thead>
              <tr>
                <th>Area</th>
                <th>Decision needed</th>
                <th>Where it lands</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="font-bold">Mailboxes</td>
                <td>Microsoft connection method, sync frequency, and access rules.</td>
                <td>Email intake</td>
              </tr>
              <tr>
                <td className="font-bold">Contact matching</td>
                <td>How strict duplicate detection should be across email, client, and name.</td>
                <td>Contacts</td>
              </tr>
              <tr>
                <td className="font-bold">Mailing exports</td>
                <td>Consent wording, exclusion rules, and export format.</td>
                <td>Mailing lists</td>
              </tr>
              <tr>
                <td className="font-bold">Jobs and quotes</td>
                <td>Whether this should link to Trello, accounting, or a new internal jobs table.</td>
                <td>Client profiles</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
