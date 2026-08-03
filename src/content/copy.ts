/**
 * All visitor-facing copy in one place so it can be edited without touching
 * components. Tone: declarative, high-contrast, spare: no exclamation points,
 * no hype, as few words as possible.
 */

export const siteCopy = {
  projectTitle: "Women's Health × AI",
  projectSubtitle: "An IDEO project",

  /**
   * The page this app is embedded within. When the standalone header is gone,
   * these give a quiet way back out to the parent site. Edit here to point at
   * the real IDEO page once it exists.
   */
  parentSite: {
    label: "ideo.com",
    url: "https://www.ideo.com",
  },

  hero: {
    /** Each entry renders as its own line, kept whole (no wrapping). */
    headlineLines: [
      "AI is coming for women's health.",
      "Where do you stand?",
    ],
    paragraph:
      "Finish one sentence, in your own words. Three short questions later, your view joins an anonymous landscape of public opinion.",
    primaryCta: "Share your view",
    secondaryCta: "See the landscape",
  },

  starters: {
    heading: "Finish the sentence",
  },

  landscapePreview: {
    heading: "See the landscape",
    cta: "Open the landscape",
  },

  about: {
    heading: "About this project",
    body: [
      "Women's Health × AI is an IDEO emerging point of view. It exists to surface where people genuinely stand, not to average their views into consensus.",
      "Every published point of view is anonymous. Views are clustered into shared topics, and within each topic the system names the creative tensions: a line between two opposing pulls that both have merit. Each voice is placed along those lines, and the whole landscape recalibrates as new voices arrive.",
      "The public artifact is never an answer or a diagnosis. It is a picture of the field's real disagreements, drawn precisely enough to work with.",
    ],
  },

  /** Versioned consent language shown at the publish step. */
  consent: {
    version: "2026-07-27",
    text: "Publish this summary anonymously to the shared landscape. Your conversation stays private; only the summary above appears, and it may be re-clustered as the landscape recalibrates.",
    publishButton: "Publish anonymously",
  },
} as const;
