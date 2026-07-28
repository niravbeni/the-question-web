import type OpenAI from "openai";

/** The single tool the facilitator uses to end the exchange. */
export const chatTools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "finalize_pov",
      description:
        "Finish the exchange by producing the anonymous public summary of the visitor's point of view. Call this when the follow-up questions are used up, when the visitor asks to finish, or earlier if their opening is already rich.",
      parameters: {
        type: "object",
        properties: {
          summary: {
            type: "string",
            description:
              "1-3 sentence anonymous third-person summary of the visitor's point of view, keeping its edge (e.g. 'Believes that…').",
          },
        },
        required: ["summary"],
        additionalProperties: false,
      },
    },
  },
];
