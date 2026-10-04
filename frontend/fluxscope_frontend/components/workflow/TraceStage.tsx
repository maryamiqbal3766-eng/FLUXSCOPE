"use client";

import { useState } from "react";
import {
  confirmIntakeDraft,
  createImpactMapping,
  createIntakeDraft,
  toApiError,
  type ApiError,
  type BusinessFact,
  type BusinessIntakeDraft,
  type BusinessProfile,
  type EconomicShockEvent,
  type ImpactGraph,
  type ImpactNode,
} from "../../lib/api";
import {
  BUSINESS_FIELDS,
  fieldLabel,
  humanize,
  isDecimal,
  type StageStatus,
} from "../../lib/workflow";
import {
  ActionButton,
  Badge,
  ErrorNotice,
  InfoNotice,
  KeyValues,
  LockedNotice,
  NextStep,
  StageFrame,
  StepTitle,
} from "./ui";

type Props = {
  status: StageStatus;
  shock: EconomicShockEvent | null;
  businessId: string | null;
  ensureBusinessId: () => string;
  profile: BusinessProfile | null;
  onProfileConfirmed: (profile: BusinessProfile) => void;
  mapping: ImpactGraph | null;
  onMapped: (mapping: ImpactGraph) => void;
  /** Fields a later stage reported as missing (from a backend blocker). */
  requestedFields: string[];
};

/** Orders the returned nodes by following the returned edges from the shock node. */
function orderedPath(graph: ImpactGraph): { node: ImpactNode; relationship?: string }[] {
  const byId = new Map(graph.nodes.map((node) => [node.id, node]));
  const start = graph.nodes.find((node) => node.node_type === "economic_shock") ?? graph.nodes[0];
  const path: { node: ImpactNode; relationship?: string }[] = [];
  const seen = new Set<string>();
  let current: ImpactNode | undefined = start;
  let relationship: string | undefined;
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    path.push({ node: current, relationship });
    const edge = graph.edges.find((item) => item.source_node_id === current?.id);
    relationship = edge?.relationship;
    current = edge ? byId.get(edge.target_node_id) : undefined;
  }
  // Any node not reachable from the shock is still shown, never hidden.
  for (const node of graph.nodes) {
    if (!seen.has(node.id)) path.push({ node });
  }
  return path;
}

export default function TraceStage({
  status,
  shock,
  businessId,
  ensureBusinessId,
  profile,
  onProfileConfirmed,
  mapping,
  onMapped,
  requestedFields,
}: Props) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [draft, setDraft] = useState<BusinessIntakeDraft | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [busy, setBusy] = useState<"draft" | "confirm" | "map" | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  const entered = BUSINESS_FIELDS.filter((field) => values[field.key]?.trim());
  const invalid = entered.filter((field) => !isDecimal(values[field.key]));
  const notEntered = BUSINESS_FIELDS.filter((field) => !values[field.key]?.trim());

  async function submitDraft() {
    setBusy("draft");
    setError(null);
    try {
      const id = ensureBusinessId();
      const submitted: Record<string, BusinessFact> = {};
      for (const field of entered) {
        submitted[field.key] = { value: values[field.key].trim(), unit: field.unit };
      }
      const created = await createIntakeDraft(id, submitted);
      setDraft(created);
      setAcknowledged(false);
    } catch (err) {
      setError(toApiError(err));
    } finally {
      setBusy(null);
    }
  }

  async function confirmDraft() {
    if (!draft) return;
    setBusy("confirm");
    setError(null);
    try {
      const confirmed = await confirmIntakeDraft(draft.business_id, draft.id);
      onProfileConfirmed(confirmed);
      setDraft(null);
    } catch (err) {
      setError(toApiError(err));
    } finally {
      setBusy(null);
    }
  }

  async function requestMapping() {
    if (!shock || !profile) return;
    setBusy("map");
    setError(null);
    try {
      onMapped(await createImpactMapping(shock.id, profile.business_id));
    } catch (err) {
      setError(toApiError(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <StageFrame
      id="stage-trace"
      number={2}
      tag="⌘ TRACE"
      title="How does it reach your business?"
      status={status}
      explanation={
        <>
          <p>
            Enter your own business facts, review them, and confirm them. Only confirmed facts are
            used. The backend then maps the selected shock through your business: economic shock →
            business dependency → operational effect → financial effect.
          </p>
          <p>
            <b>Next:</b> QUANTIFY uses these confirmed facts with the verified shock.
          </p>
        </>
      }
    >
      {!shock ? (
        <LockedNotice
          requirement="Select a detected economic shock in DETECT first. TRACE maps that specific shock to your business."
          href="#stage-detect"
        />
      ) : (
        <>
          <InfoNotice title="Shock being traced">
            <p>
              {humanize(shock.shock_type)} — {shock.economic_variable} ({shock.direction_or_change}
              {shock.magnitude ? ` ${shock.magnitude} ${shock.unit ?? ""}` : ""}), verification:{" "}
              <b>{shock.verification_status}</b>
            </p>
          </InfoNotice>

          <StepTitle index={1}>Enter your business facts</StepTitle>
          <p className="wfLead">
            Use one consistent period (for example, one month) for every quantity and amount. Leave a
            field empty if you do not know it. Nothing is filled in for you, and QUANTIFY will list
            anything it still needs.
          </p>
          {requestedFields.length > 0 ? (
            <InfoNotice tone="warn" title="QUANTIFY asked for these facts">
              <p>{requestedFields.map(fieldLabel).join(", ")}</p>
            </InfoNotice>
          ) : null}
          <div className="wfGrid">
            {BUSINESS_FIELDS.map((field) => {
              const value = values[field.key] ?? "";
              const bad = value.trim() !== "" && !isDecimal(value);
              const requested = requestedFields.includes(field.key) && !value.trim();
              return (
                <label key={field.key} className={`wfField ${bad || requested ? "wfFieldBad" : ""}`}>
                  <span>
                    {field.label} <em>({field.unit})</em>
                  </span>
                  <input
                    inputMode="decimal"
                    value={value}
                    disabled={draft !== null}
                    onChange={(event) =>
                      setValues((current) => ({ ...current, [field.key]: event.target.value }))
                    }
                  />
                  <small>{bad ? "Enter a non-negative number, e.g. 1250 or 12.5" : field.help}</small>
                </label>
              );
            })}
          </div>
          {draft === null ? (
            <div className="wfActions">
              <ActionButton
                onClick={submitDraft}
                busy={busy === "draft"}
                disabled={entered.length === 0 || invalid.length > 0}
              >
                Submit facts for review
              </ActionButton>
              {entered.length === 0 ? (
                <span className="wfHint">Enter at least one fact.</span>
              ) : notEntered.length > 0 ? (
                <span className="wfHint">
                  Not provided: {notEntered.map((field) => field.label).join(", ")}.
                </span>
              ) : null}
            </div>
          ) : null}

          {draft ? (
            <>
              <StepTitle index={2}>Review and confirm (intake draft)</StepTitle>
              <table className="wfTable">
                <thead>
                  <tr>
                    <th>Fact</th>
                    <th>Value</th>
                    <th>Unit</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(draft.submitted_fields).map(([key, fact]) => (
                    <tr key={key}>
                      <td>{fieldLabel(key)}</td>
                      <td>{fact.value}</td>
                      <td>{fact.unit ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="wfHint">
                Draft status: <Badge tone="warn">{draft.intake_status}</Badge> — unconfirmed facts are
                never used in calculations.
              </p>
              <label className="wfCheck">
                <input
                  type="checkbox"
                  checked={acknowledged}
                  onChange={(event) => setAcknowledged(event.target.checked)}
                />
                I confirm these facts are correct for my business.
              </label>
              <div className="wfActions">
                <ActionButton onClick={confirmDraft} busy={busy === "confirm"} disabled={!acknowledged}>
                  Confirm business facts
                </ActionButton>
                <ActionButton variant="secondary" onClick={() => setDraft(null)}>
                  Edit facts
                </ActionButton>
              </div>
            </>
          ) : null}

          {profile ? (
            <>
              <StepTitle index={3}>Confirmed business profile</StepTitle>
              <KeyValues
                rows={[
                  ...Object.entries(profile.confirmed_fields).map(
                    ([key, fact]) => [fieldLabel(key), `${fact.value} ${fact.unit ?? ""}`] as [string, string],
                  ),
                  ["Business ID", <code key="b">{businessId}</code>],
                  ["Profile ID", <code key="p">{profile.id}</code>],
                ]}
              />
              <p className="wfHint">
                To change a fact, edit the form above and submit a new draft. A new confirmed profile
                replaces this one and the mapping must be requested again.
              </p>

              <StepTitle index={4}>Map the shock to your business</StepTitle>
              {!mapping ? (
                <div className="wfActions">
                  <ActionButton onClick={requestMapping} busy={busy === "map"}>
                    Create impact mapping
                  </ActionButton>
                </div>
              ) : null}
            </>
          ) : null}

          {error ? <ErrorNotice error={error} title="TRACE did not complete" /> : null}

          {mapping ? (
            <>
              <div className="wfGraph">
                {orderedPath(mapping).map(({ node, relationship }) => (
                  <div key={node.id} className="wfGraphStep">
                    {relationship ? <div className="wfGraphEdge">↓ {relationship}</div> : null}
                    <div className="wfGraphNode">
                      <small>{humanize(node.node_type)}</small>
                      <strong>{node.label}</strong>
                    </div>
                  </div>
                ))}
              </div>
              <p className="wfHint">
                Mapping ID <code>{mapping.id}</code> — produced by the backend’s deterministic mapping
                rules from your confirmed facts and the shock’s direction.
              </p>
              <NextStep href="#stage-quantify">Continue to QUANTIFY</NextStep>
            </>
          ) : null}
        </>
      )}
    </StageFrame>
  );
}
