"use client";

import { useRef, useState, useTransition } from "react";

type SelectOption = {
  label: string;
  value: string;
};

type ContactOption = {
  email?: string | null;
  first_name?: string | null;
  id: string;
  last_name?: string | null;
};

type CompanyOption = {
  id: string;
  name: string;
};

type AutoSaveAction = (formData: FormData) => Promise<void> | void;

type AutoSaveStatusSelectProps = {
  action: AutoSaveAction;
  options: SelectOption[];
  value: string;
};

type AutoSaveEmailReviewFormProps = {
  action: AutoSaveAction;
  companies: CompanyOption[];
  contacts: ContactOption[];
  email: {
    company_id?: string | null;
    contact_id?: string | null;
    job_number?: string | null;
    notes?: string | null;
    status?: string | null;
    subject?: string | null;
    thread_subject?: string | null;
  };
  statusOptions: SelectOption[];
};

function getContactName(contact: ContactOption) {
  return [contact.first_name, contact.last_name].filter(Boolean).join(" ") || contact.email || "";
}

function useAutoSave() {
  const formRef = useRef<HTMLFormElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isPending, startTransition] = useTransition();
  const [hasChanged, setHasChanged] = useState(false);

  function submit(delayMs = 0) {
    setHasChanged(true);

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(() => {
      startTransition(() => {
        formRef.current?.requestSubmit();
      });
    }, delayMs);
  }

  return {
    formRef,
    hasChanged,
    isPending,
    submit,
  };
}

export function AutoSaveStatusSelect({ action, options, value }: AutoSaveStatusSelectProps) {
  const { formRef, submit } = useAutoSave();

  return (
    <form action={action} ref={formRef}>
      <select
        className="crm-input min-w-36"
        defaultValue={value}
        name="status"
        onChange={() => submit()}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </form>
  );
}

export function AutoSaveEmailReviewForm({
  action,
  companies,
  contacts,
  email,
  statusOptions,
}: AutoSaveEmailReviewFormProps) {
  const { formRef, hasChanged, isPending, submit } = useAutoSave();

  return (
    <form action={action} className="crm-card grid gap-5 p-6" ref={formRef}>
      <div>
        <h2 className="crm-section-title">Review</h2>
        <p className="crm-autosave-note mt-2">
          {isPending ? "Saving changes..." : hasChanged ? "Saved automatically" : "Changes save automatically"}
        </p>
      </div>

      <label className="grid gap-2 font-bold">
        <span>Status</span>
        <select
          className="crm-input"
          defaultValue={email.status ?? "new"}
          name="status"
          onChange={() => submit()}
        >
          {statusOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label className="grid gap-2 font-bold">
        <span>Contact</span>
        <select
          className="crm-input"
          defaultValue={email.contact_id ?? ""}
          name="contact_id"
          onChange={() => submit()}
        >
          <option value="">No contact linked</option>
          {contacts.map((contact) => (
            <option key={contact.id} value={contact.id}>
              {getContactName(contact)}
            </option>
          ))}
        </select>
      </label>

      <label className="grid gap-2 font-bold">
        <span>Client</span>
        <select
          className="crm-input"
          defaultValue={email.company_id ?? ""}
          name="company_id"
          onChange={() => submit()}
        >
          <option value="">No client linked</option>
          {companies.map((company) => (
            <option key={company.id} value={company.id}>
              {company.name}
            </option>
          ))}
        </select>
      </label>

      <input name="subject" type="hidden" value={email.subject ?? ""} />

      <label className="grid gap-2 font-bold">
        <span>Job number</span>
        <input
          className="crm-input"
          defaultValue={email.job_number ?? ""}
          name="job_number"
          onChange={() => submit(700)}
          placeholder="Example: 5932"
        />
      </label>

      <label className="grid gap-2 font-bold">
        <span>Thread subject</span>
        <input
          className="crm-input"
          defaultValue={email.thread_subject ?? ""}
          name="thread_subject"
          onChange={() => submit(700)}
          placeholder="Short thread name"
        />
      </label>

      <label className="grid gap-2 font-bold">
        <span>Notes</span>
        <textarea
          className="crm-input min-h-32"
          defaultValue={email.notes ?? ""}
          name="notes"
          onChange={() => submit(900)}
          placeholder="Follow-up notes, quote context, list decisions..."
        />
      </label>
    </form>
  );
}
