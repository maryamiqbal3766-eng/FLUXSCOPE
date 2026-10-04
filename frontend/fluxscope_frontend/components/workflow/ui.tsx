"use client";

import type { ReactNode } from "react";
import type { ApiError } from "../../lib/api";
import { fieldLabel, type StageStatus } from "../../lib/workflow";

export function StatusPill({ status }: { status: StageStatus }) {
  return <span className={`wfPill wfPill-${status.tone}`}>{status.label}</span>;
}

export function Badge({
  tone,
  children,
}: {
  tone: "ok" | "warn" | "bad" | "neutral";
  children: ReactNode;
}) {
  return <span className={`wfBadge wfBadge-${tone}`}>{children}</span>;
}

/** Shows a backend contract error exactly as returned, plus the named fields. */
export function ErrorNotice({ error, title }: { error: ApiError; title?: string }) {
  return (
    <div className="wfNotice wfNotice-error" role="alert">
      <strong>{title ?? "The backend did not complete this step"}</strong>
      <p>{error.message}</p>
      <div className="wfNoticeMeta">
        <code>{error.code}</code>
        {error.status ? <span>HTTP {error.status}</span> : null}
        {error.stage ? <span>Stage: {error.stage}</span> : null}
      </div>
      {error.requiredFields.length > 0 ? (
        <div className="wfNoticeFields">
          <span>Required / affected fields:</span>
          <ul>
            {error.requiredFields.map((field) => (
              <li key={field}>
                {fieldLabel(field)} <code>{field}</code>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

export function InfoNotice({
  title,
  children,
  tone = "info",
}: {
  title?: string;
  children: ReactNode;
  tone?: "info" | "warn" | "locked" | "ok";
}) {
  return (
    <div className={`wfNotice wfNotice-${tone}`}>
      {title ? <strong>{title}</strong> : null}
      <div>{children}</div>
    </div>
  );
}

export function LockedNotice({ requirement, href }: { requirement: string; href: string }) {
  return (
    <InfoNotice tone="locked" title="This stage is waiting for an earlier stage">
      <p>{requirement}</p>
      <a className="wfLink" href={href}>
        Go to the required stage ↑
      </a>
    </InfoNotice>
  );
}

export function StepTitle({ index, children }: { index: number; children: ReactNode }) {
  return (
    <h4 className="wfStepTitle">
      <span>{index}</span>
      {children}
    </h4>
  );
}

export function KeyValues({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="wfKv">
      {rows.map(([key, value]) => (
        <div key={key}>
          <dt>{key}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function ActionButton({
  onClick,
  disabled,
  busy,
  children,
  variant = "primary",
  type = "button",
}: {
  onClick?: () => void;
  disabled?: boolean;
  busy?: boolean;
  children: ReactNode;
  variant?: "primary" | "secondary";
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      className={variant === "primary" ? "wfButton" : "wfButton wfButtonSecondary"}
      onClick={onClick}
      disabled={disabled || busy}
    >
      {busy ? "Working…" : children}
    </button>
  );
}

export function NextStep({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a className="wfNext" href={href}>
      {children} <span>↓</span>
    </a>
  );
}

export function StageFrame({
  id,
  number,
  tag,
  title,
  explanation,
  status,
  children,
}: {
  id: string;
  number: number;
  tag: string;
  title: string;
  explanation: ReactNode;
  status: StageStatus;
  children: ReactNode;
}) {
  return (
    <section id={id} className="workflowSection wfSection section">
      <div className="workflowNumber">0{number}</div>
      <div className="wfBody">
        <div className="wfHeader">
          <div>
            <div className="stageTag">{tag}</div>
            <h2 className="wfTitle">{title}</h2>
          </div>
          <StatusPill status={status} />
        </div>
        <div className="wfExplain">{explanation}</div>
        <div className="workflowPanel wfPanel" dir="ltr">
          {children}
        </div>
      </div>
    </section>
  );
}
