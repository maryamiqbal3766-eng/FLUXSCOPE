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
import { useLanguage, useT } from "../../lib/i18n";
import {
  BUSINESS_FIELDS,
  fieldLabel,
  isDecimal,
  rawTerm,
  term,
  unitLabel,
  type StageStatus,
} from "../../lib/workflow";
import {
  ActionButton,
  Badge,
  ErrorNotice,
  InfoNotice,
  KeyValues,
  LockedNotice,
  Ltr,
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
  const t = useT();
  const language = useLanguage();
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
      tag={t("⌘ TRACE", "⌘ تجزیہ · TRACE")}
      title={t("How does it reach your business?", "یہ آپ کے کاروبار تک کیسے پہنچتا ہے؟")}
      status={status}
      explanation={
        <>
          <p>
            {t(
              "Enter your own business facts, review them, and confirm them. Only confirmed facts are used. The backend then maps the selected shock through your business: economic shock → business dependency → operational effect → financial effect.",
              "اپنے کاروبار کے حقائق درج کریں، ان کا جائزہ لیں اور تصدیق کریں۔ صرف تصدیق شدہ حقائق استعمال ہوتے ہیں۔ پھر بیک اینڈ منتخب جھٹکے کا راستہ آپ کے کاروبار میں دکھاتا ہے: معاشی جھٹکا ← کاروباری انحصار ← عملی اثر ← مالی اثر۔",
            )}
          </p>
          <p>
            <b>{t("Next:", "اگلا قدم:")}</b>{" "}
            {t(
              "QUANTIFY uses these confirmed facts with the verified shock.",
              "حساب (QUANTIFY) یہ تصدیق شدہ حقائق اور تصدیق شدہ جھٹکا استعمال کرتا ہے۔",
            )}
          </p>
        </>
      }
    >
      {!shock ? (
        <LockedNotice
          requirement={t(
            "Select a detected economic shock in DETECT first. TRACE maps that specific shock to your business.",
            "پہلے کھوج (DETECT) میں پایا گیا کوئی معاشی جھٹکا منتخب کریں۔ تجزیہ اسی جھٹکے کو آپ کے کاروبار سے جوڑتا ہے۔",
          )}
          href="#stage-detect"
        />
      ) : (
        <>
          <InfoNotice title={t("Shock being traced", "زیرِ تجزیہ جھٹکا")}>
            <p>
              {term(shock.shock_type, language)} — <bdi dir="auto">{shock.economic_variable}</bdi> (
              {rawTerm(shock.direction_or_change, language)}
              {shock.magnitude ? (
                <>
                  {" "}
                  <Ltr>{shock.magnitude}</Ltr> {shock.unit ? unitLabel(shock.unit, language) : ""}
                </>
              ) : (
                ""
              )}
              ){t(", verification: ", "، تصدیق: ")}
              <b>{rawTerm(shock.verification_status, language)}</b>
            </p>
          </InfoNotice>

          <StepTitle index={1}>{t("Enter your business facts", "اپنے کاروبار کے حقائق درج کریں")}</StepTitle>
          <p className="wfLead">
            {t(
              "Use one consistent period (for example, one month) for every quantity and amount. Leave a field empty if you do not know it. Nothing is filled in for you, and QUANTIFY will list anything it still needs.",
              "ہر مقدار اور رقم کے لیے ایک ہی مدت استعمال کریں (مثلاً ایک ماہ)۔ جو معلوم نہ ہو وہ خانہ خالی چھوڑ دیں۔ آپ کی جگہ کچھ نہیں بھرا جاتا، اور حساب (QUANTIFY) جو کچھ مزید درکار ہو اس کی فہرست دے گا۔",
            )}
          </p>
          {requestedFields.length > 0 ? (
            <InfoNotice tone="warn" title={t("QUANTIFY asked for these facts", "حساب (QUANTIFY) کو یہ حقائق درکار ہیں")}>
              <p>{requestedFields.map((field) => fieldLabel(field, language)).join(t(", ", "، "))}</p>
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
                    {t(field.label, field.labelUr)} <em>({unitLabel(field.unit, language)})</em>
                  </span>
                  <input
                    inputMode="decimal"
                    dir="ltr"
                    value={value}
                    disabled={draft !== null}
                    onChange={(event) =>
                      setValues((current) => ({ ...current, [field.key]: event.target.value }))
                    }
                  />
                  <small>
                    {bad
                      ? t("Enter a non-negative number, e.g. 1250 or 12.5", "منفی کے علاوہ کوئی عدد درج کریں، مثلاً 1250 یا 12.5")
                      : t(field.help, field.helpUr)}
                  </small>
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
                {t("Submit facts for review", "حقائق جائزے کے لیے جمع کریں")}
              </ActionButton>
              {entered.length === 0 ? (
                <span className="wfHint">{t("Enter at least one fact.", "کم از کم ایک حقیقت درج کریں۔")}</span>
              ) : notEntered.length > 0 ? (
                <span className="wfHint">
                  {t("Not provided: ", "درج نہیں کیے گئے: ")}
                  {notEntered.map((field) => t(field.label, field.labelUr)).join(t(", ", "، "))}
                  {t(".", "۔")}
                </span>
              ) : null}
            </div>
          ) : null}

          {draft ? (
            <>
              <StepTitle index={2}>{t("Review and confirm (intake draft)", "جائزہ اور تصدیق (ابتدائی مسودہ)")}</StepTitle>
              <table className="wfTable">
                <thead>
                  <tr>
                    <th>{t("Fact", "حقیقت")}</th>
                    <th>{t("Value", "قدر")}</th>
                    <th>{t("Unit", "اکائی")}</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(draft.submitted_fields).map(([key, fact]) => (
                    <tr key={key}>
                      <td>{fieldLabel(key, language)}</td>
                      <td className="wfNum">{fact.value}</td>
                      <td>{fact.unit ? unitLabel(fact.unit, language) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="wfHint">
                {t("Draft status: ", "مسودے کی حیثیت: ")}
                <Badge tone="warn">{rawTerm(draft.intake_status, language)}</Badge>
                {t(
                  " — unconfirmed facts are never used in calculations.",
                  " — غیر تصدیق شدہ حقائق کبھی حساب میں استعمال نہیں ہوتے۔",
                )}
              </p>
              <label className="wfCheck">
                <input
                  type="checkbox"
                  checked={acknowledged}
                  onChange={(event) => setAcknowledged(event.target.checked)}
                />
                {t("I confirm these facts are correct for my business.", "میں تصدیق کرتا/کرتی ہوں کہ یہ حقائق میرے کاروبار کے لیے درست ہیں۔")}
              </label>
              <div className="wfActions">
                <ActionButton onClick={confirmDraft} busy={busy === "confirm"} disabled={!acknowledged}>
                  {t("Confirm business facts", "کاروباری حقائق کی تصدیق کریں")}
                </ActionButton>
                <ActionButton variant="secondary" onClick={() => setDraft(null)}>
                  {t("Edit facts", "حقائق میں ترمیم کریں")}
                </ActionButton>
              </div>
            </>
          ) : null}

          {profile ? (
            <>
              <StepTitle index={3}>{t("Confirmed business profile", "تصدیق شدہ کاروباری پروفائل")}</StepTitle>
              <KeyValues
                rows={[
                  ...Object.entries(profile.confirmed_fields).map(
                    ([key, fact]) =>
                      [
                        fieldLabel(key, language),
                        <span key={key}>
                          <Ltr>{fact.value}</Ltr> {fact.unit ? unitLabel(fact.unit, language) : ""}
                        </span>,
                      ] as [string, React.ReactNode],
                  ),
                  [t("Business ID", "کاروبار کی شناخت (ID)"), <code key="b">{businessId}</code>],
                  [t("Profile ID", "پروفائل کی شناخت (ID)"), <code key="p">{profile.id}</code>],
                ]}
              />
              <p className="wfHint">
                {t(
                  "To change a fact, edit the form above and submit a new draft. A new confirmed profile replaces this one and the mapping must be requested again.",
                  "کسی حقیقت کو بدلنے کے لیے اوپر فارم میں ترمیم کر کے نیا مسودہ جمع کریں۔ نیا تصدیق شدہ پروفائل اس کی جگہ لے گا اور نقشہ دوبارہ بنوانا ہوگا۔",
                )}
              </p>

              <StepTitle index={4}>{t("Map the shock to your business", "جھٹکے کو اپنے کاروبار سے جوڑیں")}</StepTitle>
              {!mapping ? (
                <div className="wfActions">
                  <ActionButton onClick={requestMapping} busy={busy === "map"}>
                    {t("Create impact mapping", "اثرات کا نقشہ بنائیں")}
                  </ActionButton>
                </div>
              ) : null}
            </>
          ) : null}

          {error ? <ErrorNotice error={error} title={t("TRACE did not complete", "تجزیہ (TRACE) مکمل نہیں ہوا")} /> : null}

          {mapping ? (
            <>
              <div className="wfGraph">
                {orderedPath(mapping).map(({ node, relationship }) => (
                  <div key={node.id} className="wfGraphStep">
                    {relationship ? (
                      <div className="wfGraphEdge">
                        ↓ <bdi dir="auto">{relationship}</bdi>
                      </div>
                    ) : null}
                    <div className="wfGraphNode">
                      <small>{term(node.node_type, language)}</small>
                      <strong dir="auto">{node.label}</strong>
                    </div>
                  </div>
                ))}
              </div>
              <p className="wfHint">
                {t("Mapping ID ", "نقشے کی شناخت (ID) ")}
                <code>{mapping.id}</code>
                {t(
                  " — produced by the backend’s deterministic mapping rules from your confirmed facts and the shock’s direction.",
                  " — بیک اینڈ کے متعین اصولوں سے، آپ کے تصدیق شدہ حقائق اور جھٹکے کی سمت کی بنیاد پر تیار کیا گیا۔",
                )}
              </p>
              <NextStep href="#stage-quantify">{t("Continue to QUANTIFY", "حساب (QUANTIFY) کی طرف بڑھیں")}</NextStep>
            </>
          ) : null}
        </>
      )}
    </StageFrame>
  );
}
