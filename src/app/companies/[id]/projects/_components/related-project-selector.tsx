"use client";

import { useMemo, useState } from "react";

export type RelatedProject = {
  id: string;
  jobNumber: string;
  title: string;
  trelloUrl: string;
  date: string;
};

export function RelatedProjectSelector({ projects }: { projects: RelatedProject[] }) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const selectedJobNumbers = useMemo(
    () =>
      projects
        .filter((project) => selectedIds.includes(project.id))
        .map((project) => project.jobNumber),
    [projects, selectedIds],
  );

  function toggleProject(projectId: string) {
    setSelectedIds((currentIds) =>
      currentIds.includes(projectId)
        ? currentIds.filter((currentId) => currentId !== projectId)
        : [...currentIds, projectId],
    );
  }

  async function copySelectedJobs() {
    await navigator.clipboard.writeText(selectedJobNumbers.join(", "));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  if (!projects.length) {
    return <p className="crm-empty">No matching earlier projects were found.</p>;
  }

  return (
    <div className="grid gap-4">
      <div className="overflow-x-auto">
        <table className="crm-table">
          <thead>
            <tr>
              <th>Select</th>
              <th>Job</th>
              <th>Date</th>
              <th>Trello</th>
            </tr>
          </thead>
          <tbody>
            {projects.map((project) => (
              <tr key={project.id}>
                <td>
                  <input
                    aria-label={`Select job ${project.jobNumber}`}
                    checked={selectedIds.includes(project.id)}
                    className="h-5 w-5"
                    onChange={() => toggleProject(project.id)}
                    type="checkbox"
                  />
                </td>
                <td>
                  <p className="font-black">{project.jobNumber}</p>
                  <p className="crm-muted mt-1">{project.title}</p>
                </td>
                <td>{project.date}</td>
                <td>
                  <a
                    className="font-bold underline"
                    href={project.trelloUrl}
                    rel="noreferrer"
                    target="_blank"
                  >
                    Open card
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center gap-3 px-5 pb-5">
        <button
          className="crm-button crm-button-primary"
          disabled={!selectedJobNumbers.length}
          onClick={copySelectedJobs}
          type="button"
        >
          {copied ? "Copied reference jobs" : "Copy selected job numbers"}
        </button>
        <p className="crm-muted font-bold">
          {selectedJobNumbers.length
            ? selectedJobNumbers.join(", ")
            : "Select the useful previous jobs, then paste them into Trello’s Reference jobs field."}
        </p>
      </div>
    </div>
  );
}
