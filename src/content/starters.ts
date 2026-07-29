import type { SentenceStarter } from "@/lib/types";

/**
 * Default sentence starters. They seed the starters table on first run and
 * are what "Reset starters to defaults" restores in the admin screen; the
 * database copy is the live source of truth. Keep ids stable once live.
 *
 * Placeholders are deliberately neutral: an example answer in the box primes
 * people toward that answer.
 */
export const defaultStarters: SentenceStarter[] = [
  {
    id: "worries-me",
    text: "What worries me most about AI in women's health is…",
    shortLabel: "What worries me",
    hint: "",
    placeholder: "…finish the sentence in your own words",
    sortOrder: 1,
  },
  {
    id: "hope-it-fixes",
    text: "If AI got one thing right about women's health, I hope it would be…",
    shortLabel: "What I hope it fixes",
    hint: "",
    placeholder: "…finish the sentence in your own words",
    sortOrder: 2,
  },
  {
    id: "never-automate",
    text: "The part of care that should never be automated is…",
    shortLabel: "What stays human",
    hint: "",
    placeholder: "…finish the sentence in your own words",
    sortOrder: 3,
  },
  {
    id: "my-body-data",
    text: "When it comes to data about my body, I believe…",
    shortLabel: "My body, my data",
    hint: "",
    placeholder: "…finish the sentence in your own words",
    sortOrder: 4,
  },
  {
    id: "overlooked",
    text: "The people these systems are most likely to overlook are…",
    shortLabel: "Who gets overlooked",
    hint: "",
    placeholder: "…finish the sentence in your own words",
    sortOrder: 5,
  },
];
