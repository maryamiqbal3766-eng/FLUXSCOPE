"use client";

import { useEffect, useMemo, useState } from "react";
import { checkBackendHealth, detectEconomicShocks, type ShockCandidate } from "../lib/api";

type StageKey =
  | "detect"
  | "trace"
  | "quantify"
  | "simulate"
  | "compare"
  | "respond"
  | "monitor";

type Language = "en" | "ur";

type Stage = {
  key: StageKey;
  en: string;
  ur: string;
  descEn: string;
  descUr: string;
  icon: string;
  questionEn: string;
  questionUr: string;
};

const stages: Stage[] = [
  {
    key: "detect",
    en: "DETECT",
    ur: "کھوج",
    descEn: "Identify an economic change early.",
    descUr: "معاشی تبدیلی کو بروقت شناخت کریں۔",
    icon: "⌕",
    questionEn: "What’s changing?",
    questionUr: "کیا بدل رہا ہے؟",
  },
  {
    key: "trace",
    en: "TRACE",
    ur: "تجزیہ",
    descEn: "Map the change through your business.",
    descUr: "تبدیلی کے کاروباری اثرات کا راستہ سمجھیں۔",
    icon: "⌘",
    questionEn: "How does it reach your business?",
    questionUr: "یہ آپ کے کاروبار تک کیسے پہنچتا ہے؟",
  },
  {
    key: "quantify",
    en: "QUANTIFY",
    ur: "حساب",
    descEn: "Measure the verified financial effect.",
    descUr: "تصدیق شدہ مالی اثرات کی پیمائش کریں۔",
    icon: "▥",
    questionEn: "What is the measurable impact?",
    questionUr: "قابلِ پیمائش اثر کتنا ہے؟",
  },
  {
    key: "simulate",
    en: "SIMULATE",
    ur: "محاکات",
    descEn: "Explore different response assumptions.",
    descUr: "مختلف ردِعمل کے مفروضے آزمائیں۔",
    icon: "≋",
    questionEn: "What if you respond differently?",
    questionUr: "اگر آپ مختلف ردِعمل دیں تو کیا ہوگا؟",
  },
  {
    key: "compare",
    en: "COMPARE",
    ur: "موازنہ",
    descEn: "See transparent trade-offs side by side.",
    descUr: "مختلف راستوں کے نتائج کا شفاف موازنہ کریں۔",
    icon: "⚖",
    questionEn: "What are the trade-offs?",
    questionUr: "مختلف راستوں میں کیا فرق ہے؟",
  },
  {
    key: "respond",
    en: "RESPOND",
    ur: "عمل",
    descEn: "Choose and record the owner’s response.",
    descUr: "کاروباری مالک کا منتخب کردہ ردِعمل درج کریں۔",
    icon: "▤",
    questionEn: "What response will you take?",
    questionUr: "آپ کیا ردِعمل اختیار کریں گے؟",
  },
  {
    key: "monitor",
    en: "MONITOR",
    ur: "نگرانی",
    descEn: "Track actual results against projections.",
    descUr: "حقیقی نتائج کو اندازوں کے مقابلے میں دیکھیں۔",
    icon: "↗",
    questionEn: "Is reality tracking the projection?",
    questionUr: "کیا حقیقی نتائج اندازے کے مطابق ہیں؟",
  },
];

function ImpactMark({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={`brand ${compact ? "brandCompact" : ""}`}
      aria-label="FLUXSCOPE"
    >
      <svg
        className="brandMark"
        viewBox="0 0 64 64"
        role="img"
        aria-label="FLUXSCOPE logo"
        preserveAspectRatio="xMidYMid meet"
      >
        <path
          d="M10 8H38V18H20V28H32V38H10V8Z"
          fill="currentColor"
        />

        <path
          d="M54 56H26V46H44V36H32V26H54V56Z"
          fill="currentColor"
        />
      </svg>

      <div className="brandWord">
        <span>FLUXSCOPE</span>
      </div>
    </div>
  );
}

export default function Home() {
  const [active, setActive] = useState<StageKey>("detect");
  const [language, setLanguage] = useState<Language>("en");
  const [priceChange, setPriceChange] = useState(4);
  const [materialChange, setMaterialChange] = useState(-15);
  const [confirmed, setConfirmed] = useState(false);
const [backendStatus, setBackendStatus] = useState<
  "checking" | "connected" | "disconnected"
>("checking");
  const [detectedShocks, setDetectedShocks] = useState<ShockCandidate[]>([]);

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
      .then(() => {
        setBackendStatus("connected");
      })
      .catch(() => {
        setBackendStatus("disconnected");
      });
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

        if (visible)
          setActive(visible.target.id.replace("stage-", "") as StageKey);
      },
      {
        rootMargin: "-25% 0px -55% 0px",
        threshold: [0.1, 0.35, 0.65],
      },
    );

    stages.forEach((stage) => {
      const element = document.getElementById(`stage-${stage.key}`);
      if (element) observer.observe(element);
    });

    return () => observer.disconnect();
  }, []);

  const activeIndex = Math.max(
    0,
    stages.findIndex((stage) => stage.key === active),
  );

  const isUrdu = language === "ur";

  async function handleDetect() {
    try {
      const shocks = await detectEconomicShocks({
        title: "FLUXSCOPE economic signal",
        publisher: "State Bank of Pakistan",
        source_url: "https://www.sbp.org.pk/",
        source_domain: "sbp.org.pk",
        content:
          "This source document is ready for economic shock detection. Verified source content will be supplied here.",
      });

      setDetectedShocks(shocks);
    } catch (error) {
      console.error("DETECT failed:", error);
    }
  }

  const scenarioSummary = useMemo(
    () =>
      isUrdu
        ? `قیمت ${priceChange >= 0 ? "+" : ""}${priceChange}% · درآمدی مواد ${materialChange}%`
        : `Price ${priceChange >= 0 ? "+" : ""}${priceChange}% · imported material ${materialChange}%`,
    [isUrdu, priceChange, materialChange],
  );

  const copy = isUrdu
    ? {
        home: "مرکزی صفحہ",
        how: "طریقۂ کار",
        features: "خصوصیات",
        about: "تعارف",

        eyebrow: "پاکستانی ایس ایم ایز کے لیے کاروباری اثرات کی ذہانت",

        slogan:
          "جب معیشت بدلتی ہے، جانیں کہ آپ کے کاروبار میں کیا بدلتا ہے۔",

        titleA: "غیریقینی کو",
        titleB: "باخبر فیصلوں میں بدلیں۔",

        body: "FLUXSCOPE معاشی تبدیلیوں کو سمجھنے، ان کے کاروباری اثرات دیکھنے، مختلف راستے آزمانے اور اپنے ردِعمل کا فیصلہ کرنے میں مدد دیتا ہے۔",

        start: "شروع کریں",
        learn: "طریقۂ کار دیکھیں",

        trust:
          "تصدیق شدہ ذرائع، شفاف حسابات اور کاروباری مالک کے اختیار پر مبنی۔",

        intelligence: "کاروباری ذہانت",
        welcome: "FLUXSCOPE میں خوش آمدید",
        subline: "سمجھیں۔ محاکات کریں۔ فیصلہ کریں۔",

        signal: "معاشی اشارہ",
        impact: "کاروباری اثر",
        responses: "ردِعمل کے اختیارات",

        waitingData: "تصدیق شدہ معلومات کا انتظار",
        profile: "پروفائل منسلک نہیں",
        ready: "محاکات کے لیے تیار",

        details: "تفصیلات دیکھیں →",
        analysis: "تجزیہ دیکھیں →",
        explore: "اختیارات دیکھیں →",

        journey: "فیصلے کا سفر",
        fromSignal: "اشارے سے ردِعمل تک",
        stages: "مراحل",
        changed: "کیا بدلا؟",
        enters: "اثر کاروبار تک کیسے پہنچتا ہے؟",
        measured: "کیا ناپا جا سکتا ہے؟",
        couldDo: "آپ کیا ردِعمل دے سکتے ہیں؟",

        floating: "فیصلے کا ۷ مرحلوں کا سفر",

        method: "FLUXSCOPE کا طریقۂ کار",
        introTitleA: "جو بدلا ہے وہاں سے",
        introTitleB: "آپ کے فیصلے تک۔",

        intro: "FLUXSCOPE کاروباری مالک کی جگہ فیصلہ نہیں کرتا۔ یہ معاشی اشارے سے کاروباری ردِعمل تک کے راستے کو سمجھنے، حساب کرنے، آزمانے، موازنہ کرنے اور نگرانی کرنے میں آسان بناتا ہے۔",

        rule1: "تصدیق شدہ معلومات",
        rule2: "متعین حسابات",
        rule3: "شفاف محاکات",
        rule4: "کاروباری مالک کے اختیار میں فیصلہ",

        waitingEvent: "تصدیق شدہ معاشی واقعے کا انتظار ہے",
        approvedSources:
          "منظور شدہ ذرائع سے موصول ہونے والی معاشی معلومات یہاں ظاہر ہوں گی۔",
        connect: "معلومات دیکھیں →",

        notConnected: "منسلک نہیں",
        verifiedRequired: "تصدیق شدہ معلومات درکار",
        calculatedEngine: "انجن کے ذریعے حساب ہوگا",
        scenarioDraft: "محاکات کا مسودہ",
        testResponse: "ردِعمل آزمائیں",
        ownerConfirmation: "مالک کی تصدیق درکار",
        changePrice: "فروخت کی قیمت تبدیل کریں",
        materialCost: "درآمدی مواد کی لاگت",
        draftSaved: "مسودہ محفوظ ہو گیا",
        saveDraft: "مسودہ محفوظ کریں",
        uiOnly:
          "یہ کنٹرولز منظرِ عام پر موجود پروٹوٹائپ دکھاتے ہیں؛ حتمی حساب متعین محاکاتی انجن سے ہوگا۔",

        option: "اختیار",
        response: "ردِعمل",
        result: "اثر",
        awaitingCalculation: "حساب کا انتظار",
        ownerResponse: "مالک کا ردِعمل",
        noResponse: "ابھی کوئی ردِعمل درج نہیں",
        reviewThenChoose:
          "تصدیق شدہ موازنے کا جائزہ لیں، پھر اپنا ردِعمل منتخب اور محفوظ کریں۔",
        reviewOptions: "اختیارات دیکھیں →",

        notStarted: "شروع نہیں ہوا",
        monitorTitle:
          "نگرانی ابھی شروع نہیں ہوئی۔ تصدیق شدہ ردِعمل اور حقیقی نتائج درکار ہیں۔",
        actualProjected: "حقیقی بمقابلہ متوقع",
        awaitingData: "معلومات کا انتظار",
        variance: "فرق",
        reassessment: "دوبارہ جائزہ",
        notRequired: "درکار نہیں",

        closingEyebrow: "FLUXSCOPE",
        closingTitleA: "سمجھیں۔",
        closingTitleB: "محاکات کریں۔",
        closingTitleC: "فیصلہ کریں.",
        closingBody:
          "پاکستانی ایس ایم ایز کے لیے فیصلہ سازی کا نظام، جو تصدیق شدہ معلومات، شفاف حسابات اور کاروباری مالک کے اختیار پر مبنی ہے۔",
        back: "اوپر جائیں",
        footer: "© 2026 FLUXSCOPE۔ پروڈکٹ پروٹوٹائپ۔",
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

        start: "Get Started",
        learn: "See How It Works",

        trust:
          "Built around verified sources, transparent calculations, and decisions that remain with the business owner.",

        intelligence: "BUSINESS INTELLIGENCE",
        welcome: "Welcome to FLUXSCOPE",
        subline: "Understand. Simulate. Decide.",

        signal: "ECONOMIC SIGNAL",
        impact: "BUSINESS IMPACT",
        responses: "RESPONSE OPTIONS",

        waitingData: "Awaiting verified data",
        profile: "Profile not connected",
        ready: "Ready to simulate",

        details: "View details →",
        analysis: "See analysis →",
        explore: "Explore options →",

        journey: "THE DECISION JOURNEY",
        fromSignal: "From signal to response",
        stages: "07 stages",
        changed: "What changed?",
        enters: "Where does it enter?",
        measured: "What can be measured?",
        couldDo: "What could you do?",

        floating: "7-stage decision journey",

        method: "THE FLUXSCOPE METHOD",
        introTitleA: "From what changed",
        introTitleB: "to what you decide.",

        intro: "FLUXSCOPE does not make the decision for the business owner. It makes the path from economic signal to business response easier to understand, calculate, test, compare, and monitor.",

        rule1: "Verified information",
        rule2: "Deterministic calculations",
        rule3: "Transparent scenarios",
        rule4: "Decisions remain with the owner",

        waitingEvent: "Waiting for a verified economic event",
        approvedSources:
          "Verified economic information from approved sources will appear here.",
        connect: "View information →",

        notConnected: "Not connected",
        verifiedRequired: "Verified inputs required",
        calculatedEngine: "Calculated by engine",
        scenarioDraft: "SCENARIO DRAFT",
        testResponse: "Test a response",
        ownerConfirmation: "Owner confirmation required",
        changePrice: "Change selling price",
        materialCost: "Imported material cost",
        draftSaved: "Draft saved",
        saveDraft: "Save draft",
        uiOnly:
          "These controls preview the experience; final calculations come from the deterministic scenario engine.",

        option: "OPTION",
        response: "RESPONSE",
        result: "IMPACT",
        awaitingCalculation: "Awaiting calculation",
        ownerResponse: "OWNER RESPONSE",
        noResponse: "No response recorded",
        reviewThenChoose:
          "Review verified comparisons, then choose and confirm the response you want to record.",
        reviewOptions: "Review options →",

        notStarted: "NOT_STARTED",
        monitorTitle:
          "Monitoring has not started. A confirmed response and actual results are required.",
        actualProjected: "Actual vs projected",
        awaitingData: "Awaiting data",
        variance: "Variance",
        reassessment: "Reassessment",
        notRequired: "Not required",

        closingEyebrow: "FLUXSCOPE",
        closingTitleA: "Understand.",
        closingTitleB: "Simulate.",
        closingTitleC: "Decide.",
        closingBody:
          "A decision-support system for Pakistani SMEs, designed around verified information, transparent calculations, and business-owner choice.",
        back: "Back to top",
        footer: "© 2026 FLUXSCOPE. Product prototype.",
        footerTag: "Understand · Simulate · Decide",
      };

  return (
    <main className={isUrdu ? "appUr" : "appEn"}>
      <header className="topbar">
        <a href="#top" className="logoLink">
          <ImpactMark />
        </a>

        <nav className="desktopNav">
          <a className="activeNav" href="#top">
            {copy.home}
          </a>
          <a href="#how-it-works">{copy.how}</a>
          <a href="#features">{copy.features}</a>
          <a href="#about">{copy.about}</a>
        </nav>

        <div className="navActions">
          <div className="langToggle" aria-label="Language selector">
            <button
              className={language === "ur" ? "selected" : ""}
              onClick={() => setLanguage("ur")}
            >
              اردو
            </button>
            <button
              className={language === "en" ? "selected" : ""}
              onClick={() => setLanguage("en")}
            >
              English
            </button>
          </div>

          <a className="navCta" href="#stage-detect">
            {copy.start}
            <span>→</span>
          </a>
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
              <a className="primaryButton" href="#stage-detect">
                {copy.start}
                <span>→</span>
              </a>

              <a className="secondaryButton" href="#how-it-works">
                {copy.learn}
              </a>
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
                  {stages.map((stage, index) => (
                    <a
                      key={stage.key}
                      className={
                        index === activeIndex ? "sideActive" : ""
                      }
                      href={`#stage-${stage.key}`}
                    >
                      <span className="sideIcon">{stage.icon}</span>
                      {isUrdu ? stage.ur : stage.en}
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
                    <span className="miniLabel">
                      {copy.intelligence}
                    </span>
                    <h3>{copy.welcome}</h3>
                    <p>{copy.slogan}</p>
                  </div>

                  <div className="avatar">◌</div>
                </div>

                <div className="signalRow">
                  <div className="miniCard">
                    <span className="cardIcon">↗</span>
                    <small>{copy.signal}</small>
                    <strong>{copy.waitingData}</strong>
                    <span className="cardLink">{copy.details}</span>
                  </div>

                  <div className="miniCard">
                    <span className="cardIcon">▧</span>
                    <small>{copy.impact}</small>
                    <strong>{copy.profile}</strong>
                    <span className="cardLink">{copy.analysis}</span>
                  </div>

                  <div className="miniCard">
                    <span className="cardIcon">◇</span>
                    <small>{copy.responses}</small>
                    <strong>{copy.ready}</strong>
                    <span className="cardLink">{copy.explore}</span>
                  </div>
                </div>

                <div className="glanceCard conceptualJourney">
                  <div className="glanceHead">
                    <div>
                      <small>{copy.journey}</small>
                      <h4>{copy.fromSignal}</h4>
                    </div>
                    <span>{copy.stages}</span>
                  </div>

                  <div className="conceptFlow">
                    <div>
                      <span>01</span>
                      <strong>
                        {isUrdu ? "معاشی اشارہ" : "Economic signal"}
                      </strong>
                      <small>{copy.changed}</small>
                    </div>

                    <i>→</i>

                    <div>
                      <span>02</span>
                      <strong>
                        {isUrdu
                          ? "کاروباری انحصار"
                          : "Business dependency"}
                      </strong>
                      <small>{copy.enters}</small>
                    </div>

                    <i>→</i>

                    <div>
                      <span>03</span>
                      <strong>
                        {isUrdu ? "مالی اثر" : "Financial impact"}
                      </strong>
                      <small>{copy.measured}</small>
                    </div>

                    <i>→</i>

                    <div>
                      <span>04</span>
                      <strong>
                        {isUrdu
                          ? "ردِعمل کے اختیارات"
                          : "Response options"}
                      </strong>
                      <small>{copy.couldDo}</small>
                    </div>
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
              className={active === stage.key ? "railActive" : ""}
            >
              <span className="railIcon">{stage.icon}</span>

              <span>
                <b>{isUrdu ? stage.ur : stage.en}</b>
                <small>
                  {isUrdu ? stage.descUr : stage.descEn}
                </small>
              </span>

              {index < stages.length - 1 ? (
                <i className="railDivider" />
              ) : null}
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
        </div>
      </section>

      {stages.map((stage, index) => (
        <section
          id={`stage-${stage.key}`}
          key={stage.key}
          className={`workflowSection section ${
            index % 2 ? "reverse" : ""
          }`}
        >
          <div className="workflowNumber">0{index + 1}</div>

          <div className="workflowCopy">
            <div className="stageTag">
              <span className="tagIcon">{stage.icon}</span>
              {isUrdu ? stage.ur : stage.en}
            </div>

            <h2>
              {isUrdu ? stage.questionUr : stage.questionEn}
            </h2>

            <p>
              {isUrdu ? stage.descUr : stage.descEn}{" "}
              {isUrdu
                ? "نیچے دکھائی گئی حالت حقیقی پروڈکٹ کی حالت ہے؛ لائیو معاشی معلومات اور مالی اقدار منسلک بیک اینڈ سے آئیں گی۔"
                : "The screen below is a truthful product state — live intelligence and financial values will come from the connected backend rather than invented demo data."}
            </p>
          </div>

          <div className="workflowPanel">
            {stage.key === "detect" && (
              <>
                                <div className="panelHeader">
                  <span>{copy.signal}</span>
                  <b>
                    {backendStatus === "checking"
                      ? "Checking backend..."
                      : backendStatus === "connected"
                        ? "Backend connected"
                        : "Backend disconnected"}
                  </b>
                </div>

                <div className="emptyState"></div>

                <div className="emptyState">
                  <div className="emptyIcon">⌁</div>

                  <h3>{copy.waitingEvent}</h3>

                  <p>{copy.approvedSources}</p>

                  <button className="outlineButton" onClick={handleDetect}>
                    {copy.connect}
                  </button>
                </div>
              </>
            )}

            {stage.key === "trace" && (
              <div className="traceMap">
                {(isUrdu
                  ? [
                      "معاشی جھٹکا",
                      "کاروباری انحصار",
                      "عملی اثر",
                      "مالی اثر",
                    ]
                  : [
                      "Economic shock",
                      "Business dependency",
                      "Operational effect",
                      "Financial effect",
                    ]
                ).map((label, i) => (
                  <div key={label} className="traceNode">
                    <span>0{i + 1}</span>
                    <strong>{label}</strong>
                    <small>
                      {isUrdu
                        ? "تصدیق شدہ نقشے کا انتظار"
                        : "Awaiting verified mapping"}
                    </small>

                    {i < 3 ? <i>↓</i> : null}
                  </div>
                ))}
              </div>
            )}

            {stage.key === "quantify" && (
              <div className="metricEmpty">
                {[
                  [
                    isUrdu ? "لاگت" : "INPUT COST",
                    copy.verifiedRequired,
                  ],
                  [
                    isUrdu
                      ? "مجموعی منافع کا مارجن"
                      : "GROSS MARGIN",
                    copy.calculatedEngine,
                  ],
                  [
                    isUrdu ? "نقدی کی ضرورت" : "CASH REQUIREMENT",
                    copy.calculatedEngine,
                  ],
                  [
                    isUrdu ? "منافع پر اثر" : "PROFIT IMPACT",
                    copy.calculatedEngine,
                  ],
                ].map(([label, status]) => (
                  <div key={label}>
                    <small>{label}</small>
                    <strong>—</strong>
                    <span>{status}</span>
                  </div>
                ))}
              </div>
            )}

            {stage.key === "simulate" && (
              <div className="scenarioPanel">
                <div className="scenarioTop">
                  <div>
                    <small>{copy.scenarioDraft}</small>
                    <h3>{copy.testResponse}</h3>
                  </div>
                  <span>{copy.ownerConfirmation}</span>
                </div>

                <label>
                  {copy.changePrice}{" "}
                  <b>
                    {priceChange >= 0 ? "+" : ""}
                    {priceChange}%
                  </b>

                  <input
                    type="range"
                    min="-10"
                    max="15"
                    value={priceChange}
                    onChange={(event) =>
                      setPriceChange(Number(event.target.value))
                    }
                  />
                </label>

                <label>
                  {copy.materialCost}{" "}
                  <b>{materialChange}%</b>

                  <input
                    type="range"
                    min="-30"
                    max="10"
                    value={materialChange}
                    onChange={(event) =>
                      setMaterialChange(Number(event.target.value))
                    }
                  />
                </label>

                <div className="scenarioFooter">
                  <span>{scenarioSummary}</span>

                  <button
                    className="primarySmall"
                    onClick={() => setConfirmed(true)}
                  >
                    {confirmed ? copy.draftSaved : copy.saveDraft}
                  </button>
                </div>

                <p className="finePrint">{copy.uiOnly}</p>
              </div>
            )}

            {stage.key === "compare" && (
              <div className="compareTable">
                <div className="compareHead">
                  <span>{copy.option}</span>
                  <span>{copy.response}</span>
                  <span>{copy.result}</span>
                </div>

                {(isUrdu
                  ? [
                      "قیمت تبدیل کریں",
                      "درآمدی مواد کم کریں",
                      "لاگت برداشت کریں",
                    ]
                  : [
                      "Adjust price",
                      "Reduce imported input",
                      "Absorb cost",
                    ]
                ).map((label) => (
                  <div className="compareRow" key={label}>
                    <strong>{label}</strong>
                    <span>{copy.awaitingCalculation}</span>
                    <span className="neutralPill">—</span>
                  </div>
                ))}
              </div>
            )}

            {stage.key === "respond" && (
              <div className="responseCard">
                <div className="responseIcon">✓</div>

                <div>
                  <small>{copy.ownerResponse}</small>

                  <h3>{copy.noResponse}</h3>

                  <p>{copy.reviewThenChoose}</p>
                </div>

                <button className="outlineButton" onClick={handleDetect}>
                  {copy.reviewOptions}
                </button>
              </div>
            )}

            {stage.key === "monitor" && (
              <div className="monitorCard">
                <div className="monitorStatus">
                  <span className="statusDot" />
                  {copy.notStarted}
                </div>

                <h3>{copy.monitorTitle}</h3>

                <div className="monitorRows">
                  <div>
                    <span>{copy.actualProjected}</span>
                    <b>{copy.awaitingData}</b>
                  </div>

                  <div>
                    <span>{copy.variance}</span>
                    <b>—</b>
                  </div>

                  <div>
                    <span>{copy.reassessment}</span>
                    <b>{copy.notRequired}</b>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>
      ))}

      <section id="about" className="closing section">
        <div className="closingMark">
          <ImpactMark />
        </div>

        <div>
          <div className="eyebrow">
            <span />
            {copy.closingEyebrow}
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
  );
}



