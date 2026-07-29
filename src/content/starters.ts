import type { SentenceStarter } from "@/lib/types";

/**
 * Default sentence starters. They seed the starters table on first run and
 * are what "Reset starters to defaults" restores in the admin screen; the
 * database copy is the live source of truth. Keep ids stable once live.
 */
export const defaultStarters: SentenceStarter[] = [
  {
    id: "worries-me",
    text: "What worries me most about AI in women's health is…",
    shortLabel: "What worries me",
    hint: "Name the risk you actually think about, not the one in headlines.",
    placeholder:
      "…that the systems will be trained on everyone except the people they claim to help. I've seen…",
    sortOrder: 1,
  },
  {
    id: "hope-it-fixes",
    text: "If AI got one thing right about women's health, I hope it would be…",
    shortLabel: "What I hope it fixes",
    hint: "Think of a gap in care or knowledge you would close first.",
    placeholder:
      "…finally taking symptoms seriously that get dismissed today. In my experience…",
    sortOrder: 2,
  },
  {
    id: "never-automate",
    text: "The part of care that should never be automated is…",
    shortLabel: "What stays human",
    hint: "Where does a person matter in a way software cannot?",
    placeholder:
      "…the moment someone tells you news that changes your life. Because…",
    sortOrder: 3,
  },
  {
    id: "my-body-data",
    text: "When it comes to data about my body, I believe…",
    shortLabel: "My body, my data",
    hint: "Who should hold it, who should never see it, and on whose terms?",
    placeholder:
      "…that cycle and fertility data deserve stronger protection than a shopping history, since…",
    sortOrder: 4,
  },
  {
    id: "overlooked",
    text: "The people these systems are most likely to overlook are…",
    shortLabel: "Who gets overlooked",
    hint: "Whose bodies, symptoms, or circumstances are missing from the data?",
    placeholder:
      "…the ones medicine already struggles to see. For example…",
    sortOrder: 5,
  },
];