/**
 * Seed landscape: hand-written points of view with a precomputed clustering
 * into topics, tensions, and positions. This makes the landscape legible on
 * first load and lets the whole experience demo without an API key. The first
 * real recalibration replaces all of it with model-derived structure.
 */

export interface SeedTension {
  id: string;
  poleA: string;
  poleB: string;
  question: string;
  sortOrder: number;
}

export interface SeedTopic {
  id: string;
  label: string;
  summary: string;
  sortOrder: number;
  tensions: SeedTension[];
}

export interface SeedPov {
  id: string;
  starterId: string;
  rawInput: string;
  summary: string;
  topicId: string;
  /** tensionId -> score in [-1, 1]; -1 leans pole A, 1 leans pole B. */
  scores: Record<string, number>;
}

export const seedTopics: SeedTopic[] = [
  {
    id: "t-trust",
    label: "Trust and accountability",
    summary:
      "Whether AI in women's health should earn trust before deployment or build it through use: and who answers when it fails.",
    sortOrder: 1,
    tensions: [
      {
        id: "tn-trust-proof",
        poleA: "Prove it before it touches patients",
        poleB: "Deploy early and learn in the open",
        question:
          "Does waiting for proof protect women, or does it delay help that imperfect tools could already give?",
        sortOrder: 1,
      },
      {
        id: "tn-trust-control",
        poleA: "Individual control",
        poleB: "Collective oversight",
        question:
          "Should safety rest on each woman managing her own settings and consent, or on institutions accountable for everyone at once?",
        sortOrder: 2,
      },
    ],
  },
  {
    id: "t-bias",
    label: "Whose bodies are seen",
    summary:
      "Models learn from the patients medicine already saw clearly: and inherit every body it overlooked. Where should the repair happen?",
    sortOrder: 2,
    tensions: [
      {
        id: "tn-bias-where",
        poleA: "Fix the data",
        poleB: "Fix the institutions",
        question:
          "Is biased AI mostly a dataset problem to engineer away, or a mirror of clinical culture that data alone cannot correct?",
        sortOrder: 1,
      },
      {
        id: "tn-bias-scope",
        poleA: "Build women-specific systems",
        poleB: "Repair the general ones",
        question:
          "Do women need dedicated models built around their bodies, or does separating them risk a second-class track?",
        sortOrder: 2,
      },
    ],
  },
  {
    id: "t-care",
    label: "The human side of care",
    summary:
      "What AI should be allowed to do in the caring relationship itself: extend clinicians, replace front doors, or stay out of the room.",
    sortOrder: 3,
    tensions: [
      {
        id: "tn-care-role",
        poleA: "AI as extra hands for clinicians",
        poleB: "AI as the new front door to care",
        question:
          "Should AI mostly work behind the scenes for professionals, or stand between patients and the system as the first thing they meet?",
        sortOrder: 1,
      },
      {
        id: "tn-care-value",
        poleA: "Efficiency first",
        poleB: "Presence first",
        question:
          "When time is scarce, is the goal to see more patients faster, or to protect the unhurried moments that make care work?",
        sortOrder: 2,
      },
    ],
  },
  {
    id: "t-body",
    label: "Body data and autonomy",
    summary:
      "Cycle, fertility, and pregnancy data can be inferred, sold, or subpoenaed. What women give, guard, and get in return.",
    sortOrder: 4,
    tensions: [
      {
        id: "tn-body-share",
        poleA: "Share to advance the science",
        poleB: "Guard by default",
        question:
          "Does progress for the next generation justify pooling intimate data now, or should nothing leave your device without a fight?",
        sortOrder: 1,
      },
      {
        id: "tn-body-price",
        poleA: "Convenience is worth it",
        poleB: "Exposure is the real price",
        question:
          "Are cycle apps and smart devices a fair trade of data for insight, or a quiet transfer of power dressed up as self-knowledge?",
        sortOrder: 2,
      },
    ],
  },
];

export const seedPovs: SeedPov[] = [
  /* ---------- Trust and accountability ---------- */
  {
    id: "seed-trust-1",
    starterId: "worries-me",
    rawInput:
      "…that we will be asked to trust these systems before anyone is required to stand behind them. When a model gets a woman's case wrong, there is no one to call.",
    summary:
      "Believes no AI should reach patients until a named institution is legally answerable for its mistakes: trust must be earned through accountability, not requested up front.",
    topicId: "t-trust",
    scores: { "tn-trust-proof": -0.9, "tn-trust-control": 0.7 },
  },
  {
    id: "seed-trust-2",
    starterId: "hope-it-fixes",
    rawInput:
      "…that it gets deployed at all. Women in my community wait months for a specialist. An imperfect tool today beats a perfect one in ten years.",
    summary:
      "Argues that waiting for perfect evidence is its own harm: women with no access today are better served by imperfect tools that improve in the open.",
    topicId: "t-trust",
    scores: { "tn-trust-proof": 0.85, "tn-trust-control": -0.2 },
  },
  {
    id: "seed-trust-3",
    starterId: "worries-me",
    rawInput:
      "…the audit trail. I work in health tech and I have never seen a women's health model whose failure modes were published anywhere a patient could read.",
    summary:
      "Wants mandatory public failure reporting for health AI: deployment is acceptable only when every error a system makes is visible outside the company that built it.",
    topicId: "t-trust",
    scores: { "tn-trust-proof": -0.35, "tn-trust-control": 0.9 },
  },
  {
    id: "seed-trust-4",
    starterId: "my-body-data",
    rawInput:
      "…that consent screens are theater. Nobody reads them, and they shift all the responsibility onto the person with the least power in the transaction.",
    summary:
      "Sees individual consent as theater that offloads risk onto patients; safety should be an institutional duty, the way aviation does not ask passengers to review the maintenance log.",
    topicId: "t-trust",
    scores: { "tn-trust-proof": -0.5, "tn-trust-control": 0.95 },
  },
  {
    id: "seed-trust-5",
    starterId: "hope-it-fixes",
    rawInput:
      "…transparency I can act on. Give me the confidence score, the training population, and a switch to turn it off. I can take it from there.",
    summary:
      "Trusts informed individuals over institutions: wants confidence scores, training-population disclosure, and an off switch in every tool, then the freedom to decide personally.",
    topicId: "t-trust",
    scores: { "tn-trust-proof": 0.3, "tn-trust-control": -0.9 },
  },
  {
    id: "seed-trust-6",
    starterId: "never-automate",
    rawInput:
      "…the apology. When the system fails a woman, a human being should have to look her in the eye and explain what went wrong and what changes.",
    summary:
      "Holds that accountability must stay human: when AI fails a patient, a person should explain the failure face to face: systems can assist care but never absorb responsibility.",
    topicId: "t-trust",
    scores: { "tn-trust-proof": -0.6, "tn-trust-control": 0.4 },
  },

  /* ---------- Whose bodies are seen ---------- */
  {
    id: "seed-bias-1",
    starterId: "overlooked",
    rawInput:
      "…Black women, whose pain is already discounted by clinicians. A model trained on those charts learns the discounting as if it were medicine.",
    summary:
      "Warns that models trained on clinical records inherit the dismissal already written into them: for Black women especially, biased data is downstream of biased care, so the institutions must change first.",
    topicId: "t-bias",
    scores: { "tn-bias-where": 0.9, "tn-bias-scope": -0.3 },
  },
  {
    id: "seed-bias-2",
    starterId: "hope-it-fixes",
    rawInput:
      "…the data gap itself. Fund longitudinal studies of women's bodies at scale and half of this problem dissolves. The models are only as blind as their training sets.",
    summary:
      "Sees underrepresentation as fundamentally a data problem: fund large longitudinal studies of women's health and the models' blind spots close with the dataset gap.",
    topicId: "t-bias",
    scores: { "tn-bias-where": -0.9, "tn-bias-scope": -0.6 },
  },
  {
    id: "seed-bias-3",
    starterId: "overlooked",
    rawInput:
      "…anyone whose condition doesn't fit the textbook: endometriosis, PCOS, perimenopause. Medicine never studied them properly, so what exactly would the AI learn from?",
    summary:
      "Points out that for under-studied conditions like endometriosis and perimenopause there is no good data to fix: AI built on absent science can only automate the ignorance.",
    topicId: "t-bias",
    scores: { "tn-bias-where": 0.5, "tn-bias-scope": -0.75 },
  },
  {
    id: "seed-bias-4",
    starterId: "hope-it-fixes",
    rawInput:
      "…dedicated models for female physiology. We accepted sex-specific reference ranges in labs; we should demand sex-specific models everywhere it matters.",
    summary:
      "Wants purpose-built models for female physiology, on the same logic as sex-specific lab reference ranges: a general model tuned on male-default data cannot simply be patched.",
    topicId: "t-bias",
    scores: { "tn-bias-where": -0.4, "tn-bias-scope": -0.95 },
  },
  {
    id: "seed-bias-5",
    starterId: "worries-me",
    rawInput:
      "…a separate 'women's track' that gets a fraction of the funding and none of the scrutiny. Separate has never meant equal in medicine.",
    summary:
      "Fears women-specific AI becomes a underfunded side track: 'separate but equal' has a bad record in medicine, so the mainstream systems must be forced to see women properly.",
    topicId: "t-bias",
    scores: { "tn-bias-where": 0.3, "tn-bias-scope": 0.9 },
  },
  {
    id: "seed-bias-6",
    starterId: "overlooked",
    rawInput:
      "…women who never show up in the data at all: uninsured, undocumented, or treated in systems that keep paper records. You cannot debias an absence.",
    summary:
      "Notes that the most overlooked women generate no data at all: uninsured, undocumented, or outside digital systems: so every fix that starts from existing records starts too late.",
    topicId: "t-bias",
    scores: { "tn-bias-where": 0.7, "tn-bias-scope": 0.4 },
  },

  /* ---------- The human side of care ---------- */
  {
    id: "seed-care-1",
    starterId: "never-automate",
    rawInput:
      "…the first conversation after a frightening result. I'm an oncology nurse; the pause before a patient asks their real question is where care actually happens.",
    summary:
      "An experienced nurse's view: AI belongs in the paperwork, never in the pause after bad news: the unhurried human moment is the treatment, and no schedule optimization should touch it.",
    topicId: "t-care",
    scores: { "tn-care-role": -0.85, "tn-care-value": 0.95 },
  },
  {
    id: "seed-care-2",
    starterId: "hope-it-fixes",
    rawInput:
      "…triage at 2am. Most of us aren't choosing between a bot and a doctor; we're choosing between a bot and nothing, googling symptoms alone.",
    summary:
      "Welcomes AI as the front door: at 2am the real alternative is not a doctor but frightened googling, and a good triage system is care that finally shows up.",
    topicId: "t-care",
    scores: { "tn-care-role": 0.9, "tn-care-value": -0.5 },
  },
  {
    id: "seed-care-3",
    starterId: "worries-me",
    rawInput:
      "…two-tier care. The insured get the human; everyone else gets the chatbot and is told it's innovation.",
    summary:
      "Fears automation splits care into tiers: humans for those who can pay, chatbots framed as innovation for everyone else: and insists efficiency gains be spent on access, not margins.",
    topicId: "t-care",
    scores: { "tn-care-role": 0.2, "tn-care-value": 0.7 },
  },
  {
    id: "seed-care-4",
    starterId: "hope-it-fixes",
    rawInput:
      "…giving clinicians their evenings back. Every hour of documentation AI absorbs is an hour a midwife can spend with an actual patient.",
    summary:
      "Backs AI as invisible staff: absorb the documentation burden so midwives and doctors get their hours back, and measure success in reclaimed patient time, not throughput.",
    topicId: "t-care",
    scores: { "tn-care-role": -0.9, "tn-care-value": 0.35 },
  },
  {
    id: "seed-care-5",
    starterId: "never-automate",
    rawInput:
      "…nothing, honestly, if the system is better at it. Sentiment about 'the human touch' has excused a lot of rushed, dismissive appointments.",
    summary:
      "Takes the contrarian line: nothing is sacred if the machine performs better: 'the human touch' has long excused rushed, dismissive care, and patients deserve outcomes over ritual.",
    topicId: "t-care",
    scores: { "tn-care-role": 0.6, "tn-care-value": -0.9 },
  },
  {
    id: "seed-care-6",
    starterId: "overlooked",
    rawInput:
      "…new mothers. Postpartum checklists get automated while the actual question: how are you, really?: needs a person who knows your name.",
    summary:
      "Sees postpartum care as the test case: automate the checklists if you must, but 'how are you, really?' only works from a person who knows your name and notices your answer.",
    topicId: "t-care",
    scores: { "tn-care-role": -0.4, "tn-care-value": 0.85 },
  },

  /* ---------- Body data and autonomy ---------- */
  {
    id: "seed-body-1",
    starterId: "my-body-data",
    rawInput:
      "…that it should be treated like medical evidence, not marketing exhaust. My cycle data can reveal a pregnancy before I've told anyone. That deserves legal privilege.",
    summary:
      "Wants reproductive data treated like privileged medical evidence, not marketing exhaust: cycle data can reveal a pregnancy before a partner knows, and the law should treat it that way.",
    topicId: "t-body",
    scores: { "tn-body-share": 0.85, "tn-body-price": 0.9 },
  },
  {
    id: "seed-body-2",
    starterId: "my-body-data",
    rawInput:
      "…that hoarding it helps no one. Women's health is under-researched precisely because the data was never pooled. I'd donate mine tomorrow to a public research trust.",
    summary:
      "Would donate her data tomorrow: the research drought in women's health exists because data was never pooled, and a well-governed public trust is worth more than private caution.",
    topicId: "t-body",
    scores: { "tn-body-share": -0.9, "tn-body-price": -0.4 },
  },
  {
    id: "seed-body-3",
    starterId: "worries-me",
    rawInput:
      "…subpoenas. In some states, a period-tracking app is discovery material. The threat isn't hypothetical anymore.",
    summary:
      "Points to the legal reality that period-tracking data is already discovery material in some jurisdictions: under those conditions, guarding by default is not paranoia but prudence.",
    topicId: "t-body",
    scores: { "tn-body-share": 0.95, "tn-body-price": 0.75 },
  },
  {
    id: "seed-body-4",
    starterId: "my-body-data",
    rawInput:
      "…that I got more insight from two years of a cycle app than from a decade of five-minute appointments. I know the trade and I'll keep making it.",
    summary:
      "Defends the trade openly: two years with a cycle app taught her more than a decade of rushed appointments, and she accepts the data cost with her eyes open.",
    topicId: "t-body",
    scores: { "tn-body-share": -0.5, "tn-body-price": -0.9 },
  },
  {
    id: "seed-body-5",
    starterId: "hope-it-fixes",
    rawInput:
      "…federated research: models that learn across millions of women while raw data never leaves the device. We shouldn't have to pick between science and safety.",
    summary:
      "Rejects the framing entirely: federated learning lets models learn from millions of women while raw data never leaves the device: the science-versus-safety trade is an engineering failure, not a law of nature.",
    topicId: "t-body",
    scores: { "tn-body-share": -0.1, "tn-body-price": 0.3 },
  },
  {
    id: "seed-body-6",
    starterId: "overlooked",
    rawInput:
      "…teenagers. They're handing lifetime baseline data about their bodies to companies before they can legally sign a contract, and nobody has explained the stakes.",
    summary:
      "Worries most about teenagers, who hand over lifetime baselines of body data before they can legally sign a contract: autonomy means nothing if the terms were set at fifteen.",
    topicId: "t-body",
    scores: { "tn-body-share": 0.55, "tn-body-price": 0.6 },
  },
];
