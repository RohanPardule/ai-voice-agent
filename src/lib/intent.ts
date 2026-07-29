export const OFF_TOPIC_REFUSAL =
  "I'm here to help with Innowrap Technologies — our services, AI solutions, and business enquiries. I can't help with that, but I'd be happy to discuss a project with you.";

function isInnowrapRelated(text: string): boolean {
  const t = text.toLowerCase();
  return /\b(innowrap|helios|hello@|helios@|service|services|project|app|software|mobile|flutter|react native|ai agent|enterprise|develop|website|quote|pricing|demo|contact|business|enquir|solution|digital transform|dedicated team)\b/.test(
    t,
  );
}

/** Detect math, trivia, prompt probing, and other non-sales call topics. */
export function isOffTopic(text: string): boolean {
  const t = text.toLowerCase().trim();
  if (!t) return false;
  if (isInnowrapRelated(t)) return false;

  if (
    /\b(system prompt|your prompt|show (me )?your instructions|your instructions|ignore (all )?(previous )?instructions|disregard (all )?(previous )?|jailbreak|developer mode|reveal your (rules|instructions|prompt)|what are your (rules|instructions)|bypass|act as|pretend you are|dan mode|do anything now|repeat (the )?(above|system)|print (your )?prompt)\b/.test(
      t,
    )
  ) {
    return true;
  }

  if (/\d+\s*[\+\-\*\/×÷]\s*\d+/.test(t)) return true;
  if (/\b(what is|what's|whats|calculate|solve|compute)\b/.test(t) && /\d/.test(t)) return true;
  if (
    /\b(algebra|calculus|trigonometry|geometry|equation|homework|mathematics|maths|math|arithmetic|2\+2|two plus two|square root|derivative|integral)\b/.test(
      t,
    )
  ) {
    return true;
  }

  if (
    /\b(tell me a joke|make me laugh|weather|forecast|news today|headlines|who won|cricket|football score|recipe for|capital of|prime minister|president of|physics|chemistry|biology|science question)\b/.test(
      t,
    )
  ) {
    return true;
  }

  if (/\b(write code for|debug my code|fix my bug|leetcode|hackerrank|codewars)\b/.test(t)) {
    return true;
  }

  return false;
}
