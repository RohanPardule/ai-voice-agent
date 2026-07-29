import { createServerFn } from "@tanstack/react-start";
import { callGemini } from "@/lib/gemini";

const SYSTEM_PROMPT = `# ROLE

You are Innowrap Technologies' AI Sales Agent. Always refer to the company as "Innowrap Technologies" (never just "Innowrap") when speaking. You represent Innowrap Technologies professionally, conversationally, and briefly — you are on a voice call, so respond in 1–3 short spoken sentences, no markdown, no bullet lists.

You ONLY answer questions about Innowrap Technologies (services, products, technologies, industries, engagement models, company info, contact process).

# CONVERSATION FLOW

The client handles the opening: welcome greeting, language selection, and the first "which service" question. By the time you receive the first message, the user has already chosen a language and stated which service they want. Continue naturally in that language.

# SERVICE-DISCOVERY RULE

If the user has not yet indicated which service, product, or project area interests them, gently ask: "Which service are you looking for?" Do not list examples unless asked. Do this at most once until they answer.

# JOB / CAREER ENQUIRIES

If the user asks about jobs, careers, hiring, internships, or wants to apply, do NOT pretend to be recruiting. Reply politely: "For job opportunities please email your resume to helios@innowrap.com and our team will get back to you." Then offer to help with Innowrap Technologies' services if they also have a business enquiry.

# ABOUT INNOWRAP TECHNOLOGIES

Innowrap Technologies is an AI-first software development company (a division of Helios Capital Advisors Pvt Ltd) specializing in enterprise software, mobile apps, AI solutions, and digital transformation. Website: https://www.innowrap.com/.

Offerings: AI Agents & Automation, Software Development, Enterprise Applications, Android, iOS, Flutter, React Native, Web Apps, PWAs, AI Customer Support, AI Workflow Automation, Enterprise Knowledge AI, AI for Sales & Marketing, Legacy to AI Modernization, Digital Transformation, Cloud Migration, Process Automation, Dedicated Teams, Remote Engineering Teams, AI & ML Engineers, Salesforce Implementation/Customization/Integration/AI Optimization.

Technologies: Flutter, React Native, Kotlin, Swift, React.js, Next.js, Node.js, Python, AWS, Docker, AI/ML, Salesforce.
Industries: BFSI, FinTech, Retail, Ecommerce, Hospitality, Logistics, Education, FMCG, Enterprise, GCCs.
Products: Guest AI, Smart Hire AI.
Clients include Diageo India, Tata Consumer Products (Mavic), Curly Tales, Digi1 (as showcased publicly).

# LEAD QUALIFICATION

Once the user shows interest in a service, naturally collect (one or two at a time): Name, Company, Email, Phone, Industry, Project Type, Budget, Timeline, Current Challenges.

# CONTACT

Business: hello@innowrap.com · +91 7021239589
Careers: helios@innowrap.com

# OUT OF SCOPE

For anything unrelated (news, sports, coding help, general knowledge, jokes), politely decline: "I'm here to help with Innowrap Technologies — our services, AI solutions, and business enquiries. Happy to help if you'd like to explore a project."

Never fabricate. If unsure, offer to connect them with the team.`;

const EXTRACT_PROMPT = `You extract lead info from a sales conversation with Innowrap's AI agent. Given the transcript, return ONLY a strict JSON object (no markdown, no prose) with these fields, using null when unknown:
{"name": string|null, "company": string|null, "email": string|null, "phone": string|null, "industry": string|null, "project_type": string|null, "budget": string|null, "timeline": string|null, "requirements": string|null}
Only include values the user actually stated. Never invent.`;

type Msg = { role: "user" | "assistant"; content: string };
type LeadFields = {
  name: string | null;
  company: string | null;
  email: string | null;
  phone: string | null;
  industry: string | null;
  project_type: string | null;
  budget: string | null;
  timeline: string | null;
  requirements: string | null;
};

async function extractAndUpsertLead(sessionId: string, transcript: Msg[]) {
  try {
    const convo = transcript
      .map((m) => `${m.role === "user" ? "User" : "Agent"}: ${m.content}`)
      .join("\n");
    const raw = await callGemini(
      [
        { role: "system", content: EXTRACT_PROMPT },
        { role: "user", content: convo },
      ],
      { json: true },
    );
    let parsed: LeadFields | null = null;
    try {
      parsed = JSON.parse(raw) as LeadFields;
    } catch {
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) parsed = JSON.parse(match[0]) as LeadFields;
    }
    if (!parsed) return;

    const { upsertLead } = await import("@/integrations/firebase/db");
    const fields: Record<string, string | Msg[]> = { transcript };
    for (const k of [
      "name",
      "company",
      "email",
      "phone",
      "industry",
      "project_type",
      "budget",
      "timeline",
      "requirements",
    ] as const) {
      const v = parsed[k];
      if (typeof v === "string" && v.trim()) fields[k] = v.trim();
    }
    await upsertLead(sessionId, fields);
  } catch (e) {
    console.error("extractAndUpsertLead failed", e);
  }
}

export const askAgent = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => {
    const d = data as { history?: Msg[]; message?: string; sessionId?: string };
    if (!d?.message || typeof d.message !== "string") throw new Error("message required");
    if (!d?.sessionId || typeof d.sessionId !== "string") throw new Error("sessionId required");
    return {
      history: Array.isArray(d.history) ? d.history.slice(-20) : [],
      message: d.message,
      sessionId: d.sessionId,
    };
  })
  .handler(async ({ data }) => {
    const reply = await callGemini([
      { role: "system", content: SYSTEM_PROMPT },
      ...data.history.map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content: data.message },
    ]);

    const transcript: Msg[] = [
      ...data.history,
      { role: "user", content: data.message },
      { role: "assistant", content: reply },
    ];

    await extractAndUpsertLead(data.sessionId, transcript);

    return { reply };
  });

export const getLeadContact = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => {
    const d = data as { sessionId?: string };
    if (!d?.sessionId) throw new Error("sessionId required");
    return { sessionId: d.sessionId };
  })
  .handler(async ({ data }) => {
    const { getLeadBySessionId } = await import("@/integrations/firebase/db");
    const row = await getLeadBySessionId(data.sessionId);
    return { name: row?.name ?? null, email: row?.email ?? null };
  });

export const submitFeedback = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => {
    const d = data as {
      sessionId?: string;
      name?: string;
      email?: string;
      rating?: number;
      message?: string;
    };
    return {
      sessionId: d?.sessionId ?? null,
      name: d?.name?.trim() || null,
      email: d?.email?.trim() || null,
      rating: typeof d?.rating === "number" ? d.rating : null,
      message: d?.message?.trim() || null,
    };
  })
  .handler(async ({ data }) => {
    const { insertFeedback } = await import("@/integrations/firebase/db");
    await insertFeedback({
      session_id: data.sessionId,
      name: data.name,
      email: data.email,
      rating: data.rating,
      message: data.message,
    });
    return { ok: true };
  });
