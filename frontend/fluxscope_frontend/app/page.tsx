"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  API_BASE_URL,
  checkBackendHealth,
  type BusinessProfile,
  type ComparisonSet,
  type EconomicShockEvent,
  type HumanDecision,
  type ImpactGraph,
  type ImpactResultRecord,
} from "../lib/api";
import { LanguageProvider, type Language } from "../lib/i18n";
import { formatSigned, humanize, rawTerm, term, type StageKey, type StageStatus } from "../lib/workflow";
import CompareStage from "../components/workflow/CompareStage";
import DetectStage from "../components/workflow/DetectStage";
import MonitorStage, { type MonitoringEntry } from "../components/workflow/MonitorStage";
import QuantifyStage from "../components/workflow/QuantifyStage";
import RespondStage from "../components/workflow/RespondStage";
import SimulateStage, { type ScenarioRun } from "../components/workflow/SimulateStage";
import TraceStage from "../components/workflow/TraceStage";

// Language type is shared with the workflow components (lib/i18n).

type Stage = {
  key: StageKey;
  en: string;
  ur: string;
  descEn: string;
  descUr: string;
  icon: string;
};

const stages: Stage[] = [
  { key: "detect", en: "DETECT", ur: "کھوج", descEn: "Identify an economic change early.", descUr: "معاشی تبدیلی کو بروقت شناخت کریں۔", icon: "⌕" },
  { key: "trace", en: "TRACE", ur: "تجزیہ", descEn: "Map the change through your business.", descUr: "تبدیلی کے کاروباری اثرات کا راستہ سمجھیں۔", icon: "⌘" },
  { key: "quantify", en: "QUANTIFY", ur: "حساب", descEn: "Measure the verified financial effect.", descUr: "تصدیق شدہ مالی اثرات کی پیمائش کریں۔", icon: "▥" },
  { key: "simulate", en: "SIMULATE", ur: "محاکات", descEn: "Explore different response assumptions.", descUr: "مختلف ردِعمل کے مفروضے آزمائیں۔", icon: "≋" },
  { key: "compare", en: "COMPARE", ur: "موازنہ", descEn: "See transparent trade-offs side by side.", descUr: "مختلف راستوں کے نتائج کا شفاف موازنہ کریں۔", icon: "⚖" },
  { key: "respond", en: "RESPOND", ur: "عمل", descEn: "Choose and record the owner’s response.", descUr: "کاروباری مالک کا منتخب کردہ ردِعمل درج کریں۔", icon: "▤" },
  { key: "monitor", en: "MONITOR", ur: "نگرانی", descEn: "Track actual results against projections.", descUr: "حقیقی نتائج کو اندازوں کے مقابلے میں دیکھیں۔", icon: "↗" },
];

function ImpactMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`brand ${compact ? "brandCompact" : ""}`} aria-label="FLUXSCOPE">
      <svg className="brandMark" viewBox="0 0 64 64" role="img" aria-label="FLUXSCOPE logo" preserveAspectRatio="xMidYMid meet">
        <path d="M10 8H38V18H20V28H32V38H10V8Z" fill="currentColor" />
        <path d="M54 56H26V46H44V36H32V26H54V56Z" fill="currentColor" />
      </svg>
      <div className="brandWord">
        <span>FLUXSCOPE</span>
      </div>
    </div>
  );
}

export default function Home() {
  const [language, setLanguage] = useState<Language>("en");
  const [backendStatus, setBackendStatus] = useState<"checking" | "connected" | "disconnected">("checking");

  /* ---------------- Workflow state (IDs and records returned by the backend) ---------------- */
  const [shock, setShockState] = useState<EconomicShockEvent | null>(null);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [profile, setProfileState] = useState<BusinessProfile | null>(null);
  const [mapping, setMappingState] = useState<ImpactGraph | null>(null);
  const [impact, setImpactState] = useState<ImpactResultRecord | null>(null);
  const [quantifyBlocker, setQuantifyBlocker] = useState<string | null>(null);
  const [requestedFields, setRequestedFields] = useState<string[]>([]);
  const [runs, setRuns] = useState<ScenarioRun[]>([]);
  const [comparison, setComparisonState] = useState<ComparisonSet | null>(null);
  const [decision, setDecisionState] = useState<HumanDecision | null>(null);
  const [monitoring, setMonitoring] = useState<MonitoringEntry[]>([]);

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = language === "ur" ? "rtl" : "ltr";
    return () => {
      document.documentElement.lang = "en";
      document.documentElement.dir = "ltr";
    };
  }, [language]);

  useEffect(() => {
    checkBackendHealth()
      .then(() => setBackendStatus("connected"))
      .catch(() => setBackendStatus("disconnected"));
  }, []);

  /* Upstream changes invalidate every downstream record built on them. */
  const clearFromMapping = useCallback(() => {
    setMappingState(null);
    setImpactState(null);
    setQuantifyBlocker(null);
    setRuns([]);
    setComparisonState(null);
    setDecisionState(null);
    setMonitoring([]);
  }, []);

  const selectShock = useCallback(
    (next: EconomicShockEvent) => {
      setShockState(next);
      setRequestedFields([]);
      clearFromMapping();
    },
    [clearFromMapping],
  );

  const confirmProfile = useCallback(
    (next: BusinessProfile) => {
      setProfileState(next);
      setRequestedFields([]);
      clearFromMapping();
    },
    [clearFromMapping],
  );

  const setMapping = useCallback((next: ImpactGraph) => {
    setMappingState(next);
    setImpactState(null);
    setQuantifyBlocker(null);
    setRuns([]);
    setComparisonState(null);
    setDecisionState(null);
    setMonitoring([]);
  }, []);

  const setImpact = useCallback((next: ImpactResultRecord) => {
    setImpactState(next);
    setRuns([]);
    setComparisonState(null);
    setDecisionState(null);
    setMonitoring([]);
  }, []);

  const setComparison = useCallback((next: ComparisonSet) => {
    setComparisonState(next);
    setDecisionState(null);
    setMonitoring([]);
  }, []);

  const setDecision = useCallback(
    (next: HumanDecision) => {
      if (decision?.id !== next.id) setMonitoring([]);
      setDecisionState(next);
    },
    [decision],
  );

  /* The business_id path segment is client-supplied in the API contract (there is no
     business-creation endpoint), so one ID is generated for this browser session. */
  const ensureBusinessId = useCallback(() => {
    if (businessId) return businessId;
    const id = crypto.randomUUID();
    setBusinessId(id);
    return id;
  }, [businessId]);

  /* ---------------- Stage statuses derived from real workflow state ---------------- */
  const completedRuns = runs.filter((run) => run.result).length;
  const isUrdu = language === "ur";
  const statuses: Record<StageKey, StageStatus> = useMemo(() => {
    const tr = (en: string, ur: string) => (isUrdu ? ur : en);
    return {
      detect: shock
        ? {
            tone: "done",
            label: tr(
              `Shock selected · ${shock.verification_status}`,
              `جھٹکا منتخب · ${rawTerm(shock.verification_status, "ur")}`,
            ),
          }
        : { tone: "ready", label: tr("No source analysed yet", "ابھی کوئی ذریعہ نہیں پرکھا گیا") },
      trace: !shock
        ? { tone: "locked", label: tr("Waiting for DETECT", "کھوج کا انتظار") }
        : mapping
          ? { tone: "done", label: tr("Impact mapping available", "اثرات کا نقشہ تیار") }
          : profile
            ? { tone: "ready", label: tr("Business confirmed · mapping needed", "کاروبار تصدیق شدہ · نقشہ درکار") }
            : { tone: "ready", label: tr("Business data missing", "کاروباری معلومات درکار") },
      quantify: !mapping
        ? { tone: "locked", label: tr("Waiting for TRACE", "تجزیے کا انتظار") }
        : impact
          ? { tone: "done", label: tr("Calculated", "حساب مکمل") }
          : quantifyBlocker
            ? {
                tone: "blocked",
                label:
                  quantifyBlocker === "UNSUPPORTED_SHOCK_TYPE"
                    ? tr("Unsupported shock type", "غیر معاون قسم کا جھٹکا")
                    : tr("Blocked · see details", "رکاوٹ · تفصیل دیکھیں"),
              }
            : { tone: "ready", label: tr("Ready to calculate", "حساب کے لیے تیار") },
      simulate: !impact
        ? { tone: "locked", label: tr("Waiting for QUANTIFY", "حساب کا انتظار") }
        : completedRuns > 0
          ? { tone: "done", label: tr(`${completedRuns} scenario(s) simulated`, `${completedRuns} منظرنامے مکمل`) }
          : runs.length > 0
            ? { tone: "ready", label: tr("Draft · confirm and run", "مسودہ · تصدیق کر کے چلائیں") }
            : { tone: "ready", label: tr("Assumptions missing", "مفروضے درکار") },
      compare: completedRuns === 0
        ? { tone: "locked", label: tr("Waiting for SIMULATE", "محاکات کا انتظار") }
        : comparison
          ? { tone: "done", label: tr("Compared", "موازنہ مکمل") }
          : { tone: "ready", label: tr("Ready to compare", "موازنے کے لیے تیار") },
      respond: !comparison
        ? { tone: "locked", label: tr("Waiting for COMPARE", "موازنے کا انتظار") }
        : decision?.decision_status === "confirmed"
          ? { tone: "done", label: tr("Decision confirmed", "فیصلہ تصدیق شدہ") }
          : decision
            ? { tone: "ready", label: tr("Awaiting your confirmation", "آپ کی تصدیق کا انتظار") }
            : { tone: "ready", label: tr("No response recorded", "ابھی کوئی ردِعمل درج نہیں") },
      monitor: decision?.decision_status !== "confirmed"
        ? { tone: "locked", label: tr("Waiting for RESPOND", "عمل کا انتظار") }
        : monitoring.length > 0
          ? { tone: "done", label: tr(`${monitoring.length} result(s) compared`, `${monitoring.length} نتائج کا موازنہ ہوا`) }
          : { tone: "ready", label: tr("Awaiting actual results", "حقیقی نتائج کا انتظار") },
    };
  }, [isUrdu, shock, mapping, profile, impact, quantifyBlocker, runs.length, completedRuns, comparison, decision, monitoring.length]);

  const currentStage: StageKey =
    stages.find((stage) => statuses[stage.key].tone !== "done")?.key ?? "monitor";

  const copy = isUrdu
    ? {
        home: "مرکزی صفحہ",
        how: "طریقۂ کار",
        features: "خصوصیات",
        about: "تعارف",
        eyebrow: "پاکستانی ایس ایم ایز کے لیے کاروباری اثرات کی ذہانت",
        slogan: "جب معیشت بدلتی ہے، جانیں کہ آپ کے کاروبار میں کیا بدلتا ہے۔",
        titleA: "غیریقینی کو",
        titleB: "باخبر فیصلوں میں بدلیں۔",
        body: "FLUXSCOPE معاشی تبدیلیوں کو سمجھنے، ان کے کاروباری اثرات دیکھنے، مختلف راستے آزمانے اور اپنے ردِعمل کا فیصلہ کرنے میں مدد دیتا ہے۔",
        start: "شروع کریں",
        learn: "طریقۂ کار دیکھیں",
        trust: "تصدیق شدہ ذرائع، شفاف حسابات اور کاروباری مالک کے اختیار پر مبنی۔",
        intelligence: "آپ کا ورک فلو",
        welcome: "ورک فلو کی موجودہ صورتحال",
        signal: "معاشی اشارہ",
        impact: "کاروباری اثر",
        responses: "ردِعمل کے اختیارات",
        journey: "فیصلے کا سفر",
        fromSignal: "اشارے سے ردِعمل تک",
        stagesLabel: "مراحل",
        method: "FLUXSCOPE کا طریقۂ کار",
        introTitleA: "جو بدلا ہے وہاں سے",
        introTitleB: "آپ کے فیصلے تک۔",
        intro: "FLUXSCOPE کاروباری مالک کی جگہ فیصلہ نہیں کرتا۔ نیچے دیے گئے سات مراحل مکمل کریں: دکھائی جانے والی ہر قدر بیک اینڈ سے آتی ہے، اور ہر رکاوٹ بتاتی ہے کہ کیا کمی ہے اور آگے کیا کرنا ہے۔",
        rule1: "تصدیق شدہ معلومات",
        rule2: "متعین حسابات",
        rule3: "شفاف محاکات",
        rule4: "کاروباری مالک کے اختیار میں فیصلہ",
        closingTitleA: "سمجھیں۔",
        closingTitleB: "محاکات کریں۔",
        closingTitleC: "فیصلہ کریں۔",
        closingBody: "پاکستانی ایس ایم ایز کے لیے فیصلہ سازی کا نظام، جو تصدیق شدہ معلومات، شفاف حسابات اور کاروباری مالک کے اختیار پر مبنی ہے۔",
        back: "اوپر جائیں",
        footer: "© 2026 FLUXSCOPE۔ ڈیمو۔",
        footerTag: "سمجھیں · محاکات کریں · فیصلہ کریں",
      }
    : {
        home: "Home",
        how: "How It Works",
        features: "Features",
        about: "About",
        eyebrow: "ECONOMIC IMPACT INTELLIGENCE FOR PAKISTANI SMEs",
        slogan: "Where Economic Change Meets Business Reality.",
        titleA: "Turn uncertainty into",
        titleB: "Informed Decisions.",
        body: "FLUXSCOPE helps you understand economic changes, measure their impact on your business, explore different responses, and decide what to do.",
        start: "Start with DETECT",
        learn: "See How It Works",
        trust: "Built around verified sources, transparent calculations, and decisions that remain with the business owner.",
        intelligence: "YOUR WORKFLOW",
        welcome: "Live workflow status",
        signal: "ECONOMIC SIGNAL",
        impact: "BUSINESS IMPACT",
        responses: "RESPONSE",
        journey: "THE DECISION JOURNEY",
        fromSignal: "From signal to response",
        stagesLabel: "07 stages",
        method: "THE FLUXSCOPE METHOD",
        introTitleA: "From what changed",
        introTitleB: "to what you decide.",
        intro: "FLUXSCOPE does not make the decision for the business owner. Work through the seven stages below: every value shown comes from the backend, and every blocker tells you what is missing and what to do next.",
        rule1: "Verified information",
        rule2: "Deterministic calculations",
        rule3: "Transparent scenarios",
        rule4: "Decisions remain with the owner",
        closingTitleA: "Understand.",
        closingTitleB: "Simulate.",
        closingTitleC: "Decide.",
        closingBody: "A decision-support system for Pakistani SMEs, designed around verified information, transparent calculations, and business-owner choice.",
        back: "Back to top",
        footer: "© 2026 FLUXSCOPE. Demo.",
        footerTag: "Understand · Simulate · Decide",
      };

  const tr = (en: string, ur: string) => (isUrdu ? ur : en);
  const signalSummary = shock
    ? tr(
        `${humanize(shock.shock_type)} · ${shock.verification_status}`,
        `${term(shock.shock_type, "ur")} · ${rawTerm(shock.verification_status, "ur")}`,
      )
    : tr("No shock selected yet", "ابھی کوئی جھٹکا منتخب نہیں");
  const impactSummary = impact
    ? tr(
        `Operating profit change ${formatSigned(impact.result.profit_impact)} PKR`,
        `آپریٹنگ منافع میں تبدیلی: ${formatSigned(impact.result.profit_impact)} روپے`,
      )
    : mapping
      ? tr("Mapped · not yet quantified", "نقشہ تیار · حساب ابھی باقی")
      : profile
        ? tr("Business facts confirmed", "کاروباری حقائق تصدیق شدہ")
        : tr("No business facts yet", "ابھی کوئی کاروباری حقائق نہیں");
  const responseSummary =
    decision?.decision_status === "confirmed"
      ? tr("Decision confirmed", "فیصلہ تصدیق شدہ")
      : decision
        ? tr("Awaiting your confirmation", "آپ کی تصدیق کا انتظار")
        : comparison
          ? tr("Compared · no decision yet", "موازنہ مکمل · فیصلہ ابھی نہیں")
          : completedRuns > 0
            ? tr(`${completedRuns} scenario(s) simulated`, `${completedRuns} منظرنامے مکمل`)
            : tr("No scenarios yet", "ابھی کوئی منظرنامہ نہیں");

  return (
    <LanguageProvider value={language}>
    <main className={isUrdu ? "appUr" : "appEn"}>
      <header className="topbar">
        <a href="#top" className="logoLink">
          <ImpactMark />
        </a>

        <nav className="desktopNav">
          <a className="activeNav" href="#top">{copy.home}</a>
          <a href="#how-it-works">{copy.how}</a>
          <a href="#features">{copy.features}</a>
          <a href="#about">{copy.about}</a>
        </nav>

        <div className="navActions">
          <span className={`wfPill wfPill-${backendStatus === "connected" ? "done" : backendStatus === "checking" ? "ready" : "blocked"}`}>
            {backendStatus === "checking"
              ? tr("Checking backend…", "بیک اینڈ کی جانچ جاری…")
              : backendStatus === "connected"
                ? tr("Backend connected", "بیک اینڈ منسلک")
                : tr("Backend unreachable", "بیک اینڈ دستیاب نہیں")}
          </span>
          <div className="langToggle" aria-label="Language selector">
            <button className={language === "ur" ? "selected" : ""} onClick={() => setLanguage("ur")}>
              اردو
            </button>
            <button className={language === "en" ? "selected" : ""} onClick={() => setLanguage("en")}>
              English
            </button>
          </div>
        </div>
      </header>

      <section id="top" className="hero section">
        <div className="heroRule" aria-hidden="true" />
        <div className="heroGrid">
          <div className="heroCopy">
            <div className="eyebrow">
              <span />
              {copy.eyebrow}
            </div>
            <h1>
              {copy.titleA}
              <br />
              <em>{copy.titleB}</em>
            </h1>
            <p className="brandSlogan">{copy.slogan}</p>
            <p className="heroText">{copy.body}</p>
            <div className="heroButtons">
              <a className="primaryButton" href={`#stage-${currentStage}`}>
                {copy.start}
                <span>→</span>
              </a>
              <a className="secondaryButton" href="#how-it-works">{copy.learn}</a>
            </div>
            <div className="trustLine">
              <span className="trustDot" />
              {copy.trust}
            </div>
          </div>

          <div className="heroProduct">
            <div className="productShell">
              <aside className="productSidebar">
                <ImpactMark compact />
                <div className="sideNav">
                  {stages.map((stage) => (
                    <a
                      key={stage.key}
                      className={stage.key === currentStage ? "sideActive" : ""}
                      href={`#stage-${stage.key}`}
                    >
                      <span className="sideIcon">{stage.icon}</span>
                      {isUrdu ? stage.ur : stage.en}
                      <i className={`wfDot wfDot-${statuses[stage.key].tone}`} aria-label={statuses[stage.key].label} />
                    </a>
                  ))}
                </div>
                <div className="sideNote">
                  {isUrdu ? (
                    <>
                      مالک کا اختیار
                      <br />
                      <strong>برقرار رہتا ہے۔</strong>
                    </>
                  ) : (
                    <>
                      Owner remains
                      <br />
                      <strong>in control.</strong>
                    </>
                  )}
                </div>
              </aside>

              <div className="productMain">
                <div className="productTop">
                  <div>
                    <span className="miniLabel">{copy.intelligence}</span>
                    <h3>{copy.welcome}</h3>
                    <p>{copy.slogan}</p>
                  </div>
                </div>

                <div className="signalRow">
                  <a className="miniCard" href="#stage-detect">
                    <span className="cardIcon">↗</span>
                    <small>{copy.signal}</small>
                    <strong dir={isUrdu ? "rtl" : "ltr"}>{signalSummary}</strong>
                    <span className="cardLink">DETECT →</span>
                  </a>
                  <a className="miniCard" href="#stage-quantify">
                    <span className="cardIcon">▧</span>
                    <small>{copy.impact}</small>
                    <strong dir={isUrdu ? "rtl" : "ltr"}>{impactSummary}</strong>
                    <span className="cardLink">TRACE · QUANTIFY →</span>
                  </a>
                  <a className="miniCard" href="#stage-respond">
                    <span className="cardIcon">◇</span>
                    <small>{copy.responses}</small>
                    <strong dir={isUrdu ? "rtl" : "ltr"}>{responseSummary}</strong>
                    <span className="cardLink">SIMULATE · RESPOND →</span>
                  </a>
                </div>

                <div className="glanceCard conceptualJourney">
                  <div className="glanceHead">
                    <div>
                      <small>{copy.journey}</small>
                      <h4>{copy.fromSignal}</h4>
                    </div>
                    <span>{copy.stagesLabel}</span>
                  </div>
                  <div className="conceptFlow">
                    {(["detect", "trace", "quantify", "simulate"] as StageKey[]).map((key, index) => (
                      <div key={key}>
                        <span>0{index + 1}</span>
                        <strong>{stages.find((stage) => stage.key === key)?.[isUrdu ? "ur" : "en"]}</strong>
                        <small dir={isUrdu ? "rtl" : "ltr"}>{statuses[key].label}</small>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="stageRail">
        <div className="railInner">
          {stages.map((stage, index) => (
            <a
              key={stage.key}
              href={`#stage-${stage.key}`}
              className={stage.key === currentStage ? "railActive" : ""}
            >
              <span className="railIcon">{stage.icon}</span>
              <span>
                <b>{isUrdu ? stage.ur : stage.en}</b>
                <small className={`wfRailStatus wfRailStatus-${statuses[stage.key].tone}`} dir={isUrdu ? "rtl" : "ltr"}>
                  {statuses[stage.key].label}
                </small>
              </span>
              {index < stages.length - 1 ? <i className="railDivider" /> : null}
            </a>
          ))}
        </div>
      </section>

      <section id="features" className="introBand section">
        <div className="introLeft">
          <div className="eyebrow">
            <span />
            {copy.method}
          </div>
          <h2>
            {copy.introTitleA}
            <br />
            <em>{copy.introTitleB}</em>
          </h2>
        </div>
        <div className="introRight">
          <p>{copy.intro}</p>
          <div className="ruleList">
            <span>01&nbsp; {copy.rule1}</span>
            <span>02&nbsp; {copy.rule2}</span>
            <span>03&nbsp; {copy.rule3}</span>
            <span>04&nbsp; {copy.rule4}</span>
          </div>
          {backendStatus === "disconnected" ? (
            <div className="wfNotice wfNotice-error" dir={isUrdu ? "rtl" : "ltr"}>
              <strong>{tr("The backend is not reachable", "بیک اینڈ تک رسائی نہیں ہو رہی")}</strong>
              <p>
                {tr(
                  "No stage can run until the FLUXSCOPE API is available at ",
                  "جب تک FLUXSCOPE API اس پتے پر دستیاب نہ ہو کوئی مرحلہ نہیں چل سکتا: ",
                )}
                <code>{API_BASE_URL}</code>
                {tr(". Start the backend and reload this page.", "۔ بیک اینڈ چلائیں اور یہ صفحہ دوبارہ لوڈ کریں۔")}
              </p>
            </div>
          ) : null}
        </div>
      </section>

      <DetectStage status={statuses.detect} shock={shock} onShockSelected={selectShock} />
      <TraceStage
        status={statuses.trace}
        shock={shock}
        businessId={businessId}
        ensureBusinessId={ensureBusinessId}
        profile={profile}
        onProfileConfirmed={confirmProfile}
        mapping={mapping}
        onMapped={setMapping}
        requestedFields={requestedFields}
      />
      <QuantifyStage
        key={`quantify-${mapping?.id ?? "none"}`}
        status={statuses.quantify}
        shock={shock}
        profile={profile}
        mapping={mapping}
        impact={impact}
        onCalculated={setImpact}
        onMissingFields={setRequestedFields}
        onBlocked={setQuantifyBlocker}
      />
      <SimulateStage
        key={`simulate-${impact?.id ?? "none"}`}
        status={statuses.simulate}
        profile={profile}
        impact={impact}
        runs={runs}
        onRunsChange={setRuns}
      />
      <CompareStage
        key={`compare-${impact?.id ?? "none"}`}
        status={statuses.compare}
        impact={impact}
        runs={runs}
        comparison={comparison}
        onCompared={setComparison}
      />
      <RespondStage
        key={`respond-${comparison?.id ?? "none"}`}
        status={statuses.respond}
        comparison={comparison}
        runs={runs}
        decision={decision}
        onDecision={setDecision}
      />
      <MonitorStage
        key={`monitor-${decision?.id ?? "none"}`}
        status={statuses.monitor}
        decision={decision}
        entries={monitoring}
        onEvaluated={(entry) => setMonitoring((current) => [...current, entry])}
      />

      <section id="about" className="closing section">
        <div className="closingMark">
          <ImpactMark />
        </div>
        <div>
          <div className="eyebrow">
            <span />
            FLUXSCOPE
          </div>
          <h2>
            {copy.closingTitleA}
            <br />
            <em>{copy.closingTitleB}</em>
            <br />
            {copy.closingTitleC}
          </h2>
          <p>{copy.closingBody}</p>
          <a className="primaryButton" href="#top">
            {copy.back} <span>↑</span>
          </a>
        </div>
      </section>

      <footer>
        <ImpactMark compact />
        <span>{copy.footer}</span>
        <span>{copy.footerTag}</span>
      </footer>
    </main>
    </LanguageProvider>
  );
}
