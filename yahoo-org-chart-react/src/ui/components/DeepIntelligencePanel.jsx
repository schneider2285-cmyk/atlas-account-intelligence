import { useMemo, useState } from "react";

function stripHtml(value) {
  return String(value || "")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function countTotals(departments) {
  return departments.reduce(
    (acc, dept) => {
      acc.contacts += dept.contacts?.length || 0;
      acc.targets += dept.targets?.length || 0;
      acc.jobs += dept.jobs?.length || 0;
      acc.notes += dept.notes?.length || 0;
      return acc;
    },
    { contacts: 0, targets: 0, jobs: 0, notes: 0 }
  );
}

function NoteList({ notes = [] }) {
  return (
    <ul className="deep-note-list">
      {notes.map((note, index) => (
        <li key={`${note.type || "note"}-${index}`} className={`type-${note.type || "info"}`}>
          <span>{note.type || "info"}</span>
          <p>{stripHtml(note.text)}</p>
        </li>
      ))}
    </ul>
  );
}

function DepartmentBlock({ department, expanded, onToggle }) {
  const contactSlice = (department.contacts || []).slice(0, 5);
  const targetSlice = (department.targets || []).slice(0, 6);
  const jobSlice = (department.jobs || []).slice(0, 8);
  const noteSlice = (department.notes || []).slice(0, 4);

  return (
    <article className="deep-dept">
      <button type="button" className="deep-dept-head" onClick={onToggle}>
        <div>
          <h4>
            <span>{department.icon || "•"}</span> {department.name}
          </h4>
          <p>{department.summary}</p>
        </div>
        <strong>{expanded ? "Hide" : "Show"}</strong>
      </button>

      {expanded ? (
        <div className="deep-dept-body">
          <section>
            <h5>Initiatives</h5>
            <ul>
              {(department.initiatives || []).map((initiative, idx) => (
                <li key={`${initiative.title}-${idx}`}>
                  <strong>{initiative.title}</strong>
                  <p>{(initiative.details || []).join(" ")}</p>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h5>Known Contacts</h5>
            <ul>
              {contactSlice.map((contact, idx) => (
                <li key={`${contact.name}-${idx}`}>
                  <strong>{contact.name}</strong> <span>{contact.title}</span>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h5>Target Stakeholders</h5>
            <ul>
              {targetSlice.map((target, idx) => (
                <li key={`${target.name}-${idx}`}>
                  <strong>{target.name}</strong>
                  <p>{target.why || target.title}</p>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h5>Open Roles</h5>
            <ul>
              {jobSlice.map((job, idx) => (
                <li key={`${job.id || job.title}-${idx}`}>
                  <strong>{job.title}</strong>
                  <span>
                    {job.id ? `${job.id} · ` : ""}
                    {job.location || "Unknown location"} · {job.posted || "Unknown posting date"}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h5>Strategic Notes</h5>
            <NoteList notes={noteSlice} />
          </section>
        </div>
      ) : null}
    </article>
  );
}

export function DeepIntelligencePanel({ dossier, accountName }) {
  const departments = dossier?.departments || [];
  const priorityIntros = dossier?.priorityIntros || [];
  const [expandedIds, setExpandedIds] = useState(() => new Set(departments.slice(0, 2).map((dept) => dept.id)));

  const totals = useMemo(() => countTotals(departments), [departments]);

  const toggle = (id) => {
    setExpandedIds((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <section className="atlas-panel deep-intelligence">
      <div className="panel-head">
        <h2>Perplexity Intelligence Dossier</h2>
        <p>
          Imported strategic research for {accountName}: {departments.length} departments, {totals.contacts} contacts,
          {totals.targets} targets, {totals.jobs} open roles, {totals.notes} strategic notes.
        </p>
      </div>

      <div className="deep-kpi-row">
        <article>
          <p>Departments</p>
          <h3>{departments.length}</h3>
        </article>
        <article>
          <p>Contacts</p>
          <h3>{totals.contacts}</h3>
        </article>
        <article>
          <p>Targets</p>
          <h3>{totals.targets}</h3>
        </article>
        <article>
          <p>Open Roles</p>
          <h3>{totals.jobs}</h3>
        </article>
        <article>
          <p>Priority Intros</p>
          <h3>{priorityIntros.length}</h3>
        </article>
      </div>

      {priorityIntros.length ? (
        <div className="deep-priority-wrap">
          <h3>Priority Intros</h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Name</th>
                  <th>Title</th>
                  <th>Path</th>
                  <th>Why</th>
                </tr>
              </thead>
              <tbody>
                {priorityIntros.map((intro, idx) => (
                  <tr key={`${intro.name}-${idx}`}>
                    <td>{intro.rank || idx + 1}</td>
                    <td>{intro.name}</td>
                    <td>{intro.title}</td>
                    <td>{intro.path || "TBD"}</td>
                    <td>{intro.why}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      <div className="deep-dept-grid">
        {departments.map((department) => (
          <DepartmentBlock
            key={department.id}
            department={department}
            expanded={expandedIds.has(department.id)}
            onToggle={() => toggle(department.id)}
          />
        ))}
      </div>
    </section>
  );
}
