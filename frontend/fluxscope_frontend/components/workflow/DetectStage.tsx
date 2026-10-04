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
import { useLanguage, useT } from "../../lib/i18n";
import { formatDate, formatValue, rawTerm, term, unitLabel, type StageStatus } from "../../lib/workflow";
import {
  ActionButton,
  Badge,
  ErrorNotice,
  InfoNotice,
  KeyValues,
  Ltr,
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
  const t = useT();
  const language = useLanguage();
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
    !publisher && t("publisher", "ناشر"),
    !sourceUrl.trim() && t("source URL", "ماخذ کا URL"),
    !title.trim() && t("title", "عنوان"),
    !content.trim() && t("source text", "ماخذ کا متن"),
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
      tag={t("⌕ DETECT", "⌕ کھوج · DETECT")}
      title={t("What’s changing?", "کیا بدل رہا ہے؟")}
      status={status}
      explanation={
        <>
          <p>
            {t(
              "Paste the text of an economic publication from an approved source. The backend checks the source against the approved-source registry, extracts candidate economic shocks, and verifies each one against the quoted evidence. Nothing is fetched or invented: only the text you submit is analysed.",
              "کسی منظور شدہ ذریعے کی معاشی اشاعت کا متن یہاں چسپاں کریں۔ بیک اینڈ ذریعے کو منظور شدہ ذرائع کی فہرست سے جانچتا ہے، ممکنہ معاشی جھٹکے نکالتا ہے، اور ہر ایک کی تصدیق اقتباس شدہ ثبوت سے کرتا ہے۔ کچھ بھی خود سے حاصل یا گھڑا نہیں جاتا؛ صرف آپ کا جمع کرایا گیا متن پرکھا جاتا ہے۔",
            )}
          </p>
          <p>
            <b>{t("Next:", "اگلا قدم:")}</b>{" "}
            {t("choose one detected shock to carry into TRACE.", "پائے گئے جھٹکوں میں سے ایک منتخب کریں جو تجزیہ (TRACE) میں جائے گا۔")}
          </p>
        </>
      }
    >
      <StepTitle index={1}>{t("Enter the source", "ذریعہ درج کریں")}</StepTitle>
      {sourcesError ? (
        <ErrorNotice error={sourcesError} title={t("Approved sources could not be loaded", "منظور شدہ ذرائع لوڈ نہیں ہو سکے")} />
      ) : null}
      <div className="wfGrid">
        <label className="wfField">
          <span>{t("Publisher (approved sources only)", "ناشر (صرف منظور شدہ ذرائع)")}</span>
          <select value={publisher} onChange={(event) => setPublisher(event.target.value)}>
            <option value="">{t("Select the publisher…", "ناشر منتخب کریں…")}</option>
            {sources.map((source) => (
              <option key={source.publisher} value={source.publisher}>
                {source.publisher}
              </option>
            ))}
          </select>
          <small>
            {selectedSource ? (
              <>
                {t("The source URL must be on ", "ماخذ کا URL اس ڈومین پر ہونا چاہیے: ")}
                <Ltr>{selectedSource.domains.join(", ")}</Ltr>
                {t(".", "۔")}
              </>
            ) : (
              t(
                "The backend accepts only sources on its approved-source registry.",
                "بیک اینڈ صرف وہی ذرائع قبول کرتا ہے جو منظور شدہ فہرست میں شامل ہیں۔",
              )
            )}
          </small>
        </label>
        <label className="wfField">
          <span>{t("Source URL", "ماخذ کا URL")}</span>
          <input
            type="url"
            dir="ltr"
            value={sourceUrl}
            onChange={(event) => setSourceUrl(event.target.value)}
            placeholder="https://…"
          />
          <small>
            {t(
              "The page the text was copied from. Verification checks its domain.",
              "وہ صفحہ جہاں سے متن لیا گیا۔ تصدیق اس کے ڈومین کی جانچ کرتی ہے۔",
            )}
          </small>
        </label>
        <label className="wfField">
          <span>{t("Title", "عنوان")}</span>
          <input dir="auto" value={title} onChange={(event) => setTitle(event.target.value)} />
          <small>{t("The publication’s title as shown by the source.", "اشاعت کا عنوان، جیسا ذریعے نے دیا ہے۔")}</small>
        </label>
        <label className="wfField">
          <span>{t("Publication date (optional)", "تاریخِ اشاعت (اختیاری)")}</span>
          <input
            type="date"
            dir="ltr"
            value={publishedAt}
            onChange={(event) => setPublishedAt(event.target.value)}
          />
          <small>
            {t(
              "Used as the shock date only if the text states no effective date.",
              "صرف اس صورت میں جھٹکے کی تاریخ مانی جائے گی جب متن میں نفاذ کی تاریخ درج نہ ہو۔",
            )}
          </small>
        </label>
        <label className="wfField wfFieldWide">
          <span>{t("Source text", "ماخذ کا متن")}</span>
          <textarea
            rows={7}
            dir="auto"
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder={t(
              "Paste the relevant paragraph(s) of the publication here.",
              "اشاعت کا متعلقہ پیراگراف یہاں چسپاں کریں۔",
            )}
          />
          <small>{t("Only this text is analysed and quoted as evidence.", "صرف یہی متن پرکھا جاتا ہے اور بطور ثبوت پیش کیا جاتا ہے۔")}</small>
        </label>
      </div>

      <div className="wfActions">
        <ActionButton onClick={handleDetect} busy={busy} disabled={missing.length > 0}>
          {t("Detect economic shocks", "معاشی جھٹکے تلاش کریں")}
        </ActionButton>
        {missing.length > 0 ? (
          <span className="wfHint">
            {t("Still needed: ", "ابھی درکار: ")}
            {missing.join(t(", ", "، "))}
            {t(".", "۔")}
          </span>
        ) : null}
      </div>

      {error ? <ErrorNotice error={error} title={t("DETECT did not complete", "کھوج (DETECT) مکمل نہیں ہوئی")} /> : null}

      {candidates !== null ? (
        <>
          <StepTitle index={2}>{t("Review what the backend detected", "بیک اینڈ نے جو پایا اس کا جائزہ لیں")}</StepTitle>
          {candidates.length === 0 ? (
            <InfoNotice tone="warn" title={t("No economic shock was detected in this text", "اس متن میں کوئی معاشی جھٹکا نہیں ملا")}>
              <p>
                {t(
                  "The extraction found no supported economic change in the submitted text. Try a passage that explicitly reports a change (for example, an exchange-rate movement).",
                  "جمع کرائے گئے متن میں کوئی معاون معاشی تبدیلی نہیں ملی۔ ایسا اقتباس آزمائیں جس میں تبدیلی واضح طور پر بیان ہو (مثلاً شرحِ مبادلہ میں تبدیلی)۔",
                )}
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
                      <strong>{term(candidate.shock_type, language)}</strong>
                      <Badge tone={verificationTone(candidate.verification_status)}>
                        {term(candidate.verification_status, language)}
                      </Badge>
                    </header>
                    <KeyValues
                      rows={[
                        [t("Variable", "متغیر"), <bdi key="v" dir="auto">{candidate.variable}</bdi>],
                        [t("Direction / change", "سمت / تبدیلی"), rawTerm(candidate.direction_or_change, language)],
                        [
                          t("Magnitude", "مقدار"),
                          candidate.magnitude === null ? (
                            t("Not stated in the source", "ذریعے میں درج نہیں")
                          ) : (
                            <span key="m">
                              <Ltr>{formatValue(candidate.magnitude, 4, language)}</Ltr>{" "}
                              {candidate.unit ? unitLabel(candidate.unit, language) : t("(no unit stated)", "(اکائی درج نہیں)")}
                            </span>
                          ),
                        ],
                        [t("Effective date", "تاریخِ نفاذ"), <Ltr key="d">{formatDate(candidate.effective_date, language)}</Ltr>],
                        [
                          t("Potential dependencies", "ممکنہ انحصار"),
                          candidate.potential_dependencies.length ? (
                            <bdi key="p" dir="auto">{candidate.potential_dependencies.join(", ")}</bdi>
                          ) : (
                            t("None stated", "کوئی درج نہیں")
                          ),
                        ],
                      ]}
                    />
                    {candidate.verification_notes.length ? (
                      <ul className={`wfNotes ${rejected ? "wfNotesBad" : ""}`}>
                        {candidate.verification_notes.map((note) => (
                          <li key={note}>
                            <bdi>{note}</bdi>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    {candidate.source_evidence.map((evidence) => (
                      <details key={evidence.quote} className="wfEvidence">
                        <summary>
                          {t("Evidence from ", "ثبوت: ")}
                          {evidence.publisher}
                          {evidence.source_url ? <> — <Ltr>{evidence.source_url}</Ltr></> : ""}
                        </summary>
                        <blockquote dir="auto">{evidence.quote}</blockquote>
                      </details>
                    ))}
                    <div className="wfActions">
                      {selected ? (
                        <Badge tone="ok">{t("Selected for TRACE", "تجزیہ (TRACE) کے لیے منتخب")}</Badge>
                      ) : (
                        <ActionButton
                          variant={rejected ? "secondary" : "primary"}
                          disabled={rejected}
                          busy={registering === candidate.shock_id}
                          onClick={() => handleUse(candidate)}
                        >
                          {t("Use this shock", "یہ جھٹکا استعمال کریں")}
                        </ActionButton>
                      )}
                      {rejected ? (
                        <span className="wfHint">
                          {t(
                            "Rejected by verification — it cannot enter TRACE.",
                            "تصدیق میں مسترد — یہ تجزیہ (TRACE) میں نہیں جا سکتا۔",
                          )}
                        </span>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </>
      ) : null}

      {registerError ? (
        <ErrorNotice error={registerError} title={t("The shock could not be selected", "یہ جھٹکا منتخب نہیں ہو سکا")} />
      ) : null}

      {shock ? (
        <>
          <StepTitle index={3}>{t("Shock carried into the workflow", "ورک فلو میں شامل کیا گیا جھٹکا")}</StepTitle>
          <KeyValues
            rows={[
              [
                t("Shock", "جھٹکا"),
                <span key="s">
                  {term(shock.shock_type, language)} — <bdi dir="auto">{shock.economic_variable}</bdi>
                </span>,
              ],
              [t("Direction / change", "سمت / تبدیلی"), rawTerm(shock.direction_or_change, language)],
              [
                t("Magnitude", "مقدار"),
                shock.magnitude === null ? (
                  t("Not stated in the source", "ذریعے میں درج نہیں")
                ) : (
                  <span key="m">
                    <Ltr>{shock.magnitude}</Ltr> {shock.unit ? unitLabel(shock.unit, language) : ""}
                  </span>
                ),
              ],
              [t("Date", "تاریخ"), <Ltr key="d">{shock.observed_or_effective_date}</Ltr>],
              [
                t("Verification", "تصدیق"),
                <Badge key="v" tone={verificationTone(shock.verification_status)}>
                  {rawTerm(shock.verification_status, language)}
                </Badge>,
              ],
              [t("Source", "ذریعہ"), shock.provenance.map((item) => item.source_name).join(", ")],
              [t("Notes", "نوٹس"), <bdi key="n" dir="auto">{shock.source_notes ?? "—"}</bdi>],
              [t("Shock ID", "جھٹکے کی شناخت (ID)"), <code key="id">{shock.id}</code>],
            ]}
          />
          {shock.verification_status !== "verified" ? (
            <InfoNotice tone="warn" title={t("Not verified", "غیر تصدیق شدہ")}>
              <p>
                {t(
                  "TRACE may use this shock, but QUANTIFY requires a verified shock.",
                  "تجزیہ (TRACE) یہ جھٹکا استعمال کر سکتا ہے، لیکن حساب (QUANTIFY) کے لیے تصدیق شدہ جھٹکا ضروری ہے۔",
                )}
              </p>
            </InfoNotice>
          ) : null}
          <NextStep href="#stage-trace">{t("Continue to TRACE", "تجزیہ (TRACE) کی طرف بڑھیں")}</NextStep>
        </>
      ) : null}
    </StageFrame>
  );
}
