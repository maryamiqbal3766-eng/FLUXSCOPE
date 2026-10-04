"use client";

import { useEffect, useState } from "react";
import {
  detectEconomicShocks,
  listApprovedSources,
  registerDetectedShock,
  toApiError,
  type ApiError,
  type ApprovedSource,
  type EconomicShockEvent,
  type ShockCandidate,
} from "../../lib/api";
import { formatDate, formatValue, humanize, type StageStatus } from "../../lib/workflow";
import {
  ActionButton,
  Badge,
  ErrorNotice,
  InfoNotice,
  KeyValues,
  NextStep,
  StageFrame,
  StepTitle,
} from "./ui";

type Props = {
  status: StageStatus;
  shock: EconomicShockEvent | null;
  onShockSelected: (shock: EconomicShockEvent) => void;
};

export function verificationTone(status: string): "ok" | "warn" | "bad" {
  const normalized = status.toLowerCase();
  if (normalized === "verified") return "ok";
  if (normalized === "rejected") return "bad";
  return "warn";
}

export default function DetectStage({ status, shock, onShockSelected }: Props) {
  const [sources, setSources] = useState<ApprovedSource[]>([]);
  const [sourcesError, setSourcesError] = useState<ApiError | null>(null);
  const [publisher, setPublisher] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [title, setTitle] = useState("");
  const [publishedAt, setPublishedAt] = useState("");
  const [content, setContent] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [candidates, setCandidates] = useState<ShockCandidate[] | null>(null);
  const [registering, setRegistering] = useState<string | null>(null);
  const [registerError, setRegisterError] = useState<ApiError | null>(null);

  useEffect(() => {
    listApprovedSources()
      .then(setSources)
      .catch((err) => setSourcesError(toApiError(err)));
  }, []);

  const selectedSource = sources.find((source) => source.publisher === publisher);
  const missing = [
    !publisher && "publisher",
    !sourceUrl.trim() && "source URL",
    !title.trim() && "title",
    !content.trim() && "source text",
  ].filter(Boolean) as string[];

  async function handleDetect() {
    setBusy(true);
    setError(null);
    setRegisterError(null);
    setCandidates(null);
    try {
      const result = await detectEconomicShocks({
        title: title.trim(),
        publisher,
        source_url: sourceUrl.trim(),
        content: content.trim(),
        ...(publishedAt ? { published_at: publishedAt } : {}),
      });
      setCandidates(result);
    } catch (err) {
      setError(toApiError(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleUse(candidate: ShockCandidate) {
    setRegistering(candidate.shock_id);
    setRegisterError(null);
    try {
      const event = await registerDetectedShock(candidate.shock_id);
      onShockSelected(event);
    } catch (err) {
      setRegisterError(toApiError(err));
    } finally {
      setRegistering(null);
    }
  }

  return (
    <StageFrame
      id="stage-detect"
      number={1}
      tag="⌕ DETECT"
      title="What’s changing?"
      status={status}
      explanation={
        <>
          <p>
            Paste the text of an economic publication from an approved source. The backend checks
            the source against the approved-source registry, extracts candidate economic shocks,
            and verifies each one against the quoted evidence. Nothing is fetched or invented: only
            the text you submit is analysed.
          </p>
          <p>
            <b>Next:</b> choose one detected shock to carry into TRACE.
          </p>
        </>
      }
    >
      <StepTitle index={1}>Enter the source</StepTitle>
      {sourcesError ? (
        <ErrorNotice error={sourcesError} title="Approved sources could not be loaded" />
      ) : null}
      <div className="wfGrid">
        <label className="wfField">
          <span>Publisher (approved sources only)</span>
          <select value={publisher} onChange={(event) => setPublisher(event.target.value)}>
            <option value="">Select the publisher…</option>
            {sources.map((source) => (
              <option key={source.publisher} value={source.publisher}>
                {source.publisher}
              </option>
            ))}
          </select>
          <small>
            {selectedSource
              ? `The source URL must be on ${selectedSource.domains.join(", ")}.`
              : "The backend accepts only sources on its approved-source registry."}
          </small>
        </label>
        <label className="wfField">
          <span>Source URL</span>
          <input
            type="url"
            value={sourceUrl}
            onChange={(event) => setSourceUrl(event.target.value)}
            placeholder="https://…"
          />
          <small>The page the text was copied from. Verification checks its domain.</small>
        </label>
        <label className="wfField">
          <span>Title</span>
          <input value={title} onChange={(event) => setTitle(event.target.value)} />
          <small>The publication’s title as shown by the source.</small>
        </label>
        <label className="wfField">
          <span>Publication date (optional)</span>
          <input
            type="date"
            value={publishedAt}
            onChange={(event) => setPublishedAt(event.target.value)}
          />
          <small>Used as the shock date only if the text states no effective date.</small>
        </label>
        <label className="wfField wfFieldWide">
          <span>Source text</span>
          <textarea
            rows={7}
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder="Paste the relevant paragraph(s) of the publication here."
          />
          <small>Only this text is analysed and quoted as evidence.</small>
        </label>
      </div>

      <div className="wfActions">
        <ActionButton onClick={handleDetect} busy={busy} disabled={missing.length > 0}>
          Detect economic shocks
        </ActionButton>
        {missing.length > 0 ? <span className="wfHint">Still needed: {missing.join(", ")}.</span> : null}
      </div>

      {error ? <ErrorNotice error={error} title="DETECT did not complete" /> : null}

      {candidates !== null ? (
        <>
          <StepTitle index={2}>Review what the backend detected</StepTitle>
          {candidates.length === 0 ? (
            <InfoNotice tone="warn" title="No economic shock was detected in this text">
              <p>
                The extraction found no supported economic change in the submitted text. Try a
                passage that explicitly reports a change (for example, an exchange-rate movement).
              </p>
            </InfoNotice>
          ) : (
            <div className="wfCards">
              {candidates.map((candidate) => {
                const rejected = candidate.verification_status === "REJECTED";
                const selected = shock?.id === candidate.shock_id;
                return (
                  <article key={candidate.shock_id} className={`wfCard ${selected ? "wfCardSelected" : ""}`}>
                    <header>
                      <strong>{humanize(candidate.shock_type)}</strong>
                      <Badge tone={verificationTone(candidate.verification_status)}>
                        {humanize(candidate.verification_status)}
                      </Badge>
                    </header>
                    <KeyValues
                      rows={[
                        ["Variable", candidate.variable],
                        ["Direction / change", candidate.direction_or_change],
                        [
                          "Magnitude",
                          candidate.magnitude === null
                            ? "Not stated in the source"
                            : `${formatValue(candidate.magnitude, 4)} ${candidate.unit ?? "(no unit stated)"}`,
                        ],
                        ["Effective date", formatDate(candidate.effective_date)],
                        [
                          "Potential dependencies",
                          candidate.potential_dependencies.length
                            ? candidate.potential_dependencies.join(", ")
                            : "None stated",
                        ],
                      ]}
                    />
                    {candidate.verification_notes.length ? (
                      <ul className={`wfNotes ${rejected ? "wfNotesBad" : ""}`}>
                        {candidate.verification_notes.map((note) => (
                          <li key={note}>{note}</li>
                        ))}
                      </ul>
                    ) : null}
                    {candidate.source_evidence.map((evidence) => (
                      <details key={evidence.quote} className="wfEvidence">
                        <summary>
                          Evidence from {evidence.publisher}
                          {evidence.source_url ? ` — ${evidence.source_url}` : ""}
                        </summary>
                        <blockquote>{evidence.quote}</blockquote>
                      </details>
                    ))}
                    <div className="wfActions">
                      {selected ? (
                        <Badge tone="ok">Selected for TRACE</Badge>
                      ) : (
                        <ActionButton
                          variant={rejected ? "secondary" : "primary"}
                          disabled={rejected}
                          busy={registering === candidate.shock_id}
                          onClick={() => handleUse(candidate)}
                        >
                          Use this shock
                        </ActionButton>
                      )}
                      {rejected ? (
                        <span className="wfHint">Rejected by verification — it cannot enter TRACE.</span>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </>
      ) : null}

      {registerError ? <ErrorNotice error={registerError} title="The shock could not be selected" /> : null}

      {shock ? (
        <>
          <StepTitle index={3}>Shock carried into the workflow</StepTitle>
          <KeyValues
            rows={[
              ["Shock", `${humanize(shock.shock_type)} — ${shock.economic_variable}`],
              ["Direction / change", shock.direction_or_change],
              [
                "Magnitude",
                shock.magnitude === null ? "Not stated in the source" : `${shock.magnitude} ${shock.unit ?? ""}`,
              ],
              ["Date", shock.observed_or_effective_date],
              [
                "Verification",
                <Badge key="v" tone={verificationTone(shock.verification_status)}>
                  {shock.verification_status}
                </Badge>,
              ],
              ["Source", shock.provenance.map((item) => item.source_name).join(", ")],
              ["Notes", shock.source_notes ?? "—"],
              ["Shock ID", <code key="id">{shock.id}</code>],
            ]}
          />
          {shock.verification_status !== "verified" ? (
            <InfoNotice tone="warn" title="Not verified">
              <p>TRACE may use this shock, but QUANTIFY requires a verified shock.</p>
            </InfoNotice>
          ) : null}
          <NextStep href="#stage-trace">Continue to TRACE</NextStep>
        </>
      ) : null}
    </StageFrame>
  );
}
