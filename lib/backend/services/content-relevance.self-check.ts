/**
 * Lightweight self-check for reply relevance guardrails.
 * Run: npx tsx lib/backend/services/content-relevance.self-check.ts
 */
import {
  countJargonPhrases,
  evaluateReplyRelevance,
  extractReplySemanticContext,
  isSurfaceAnchoredReply,
  isThreadRepetition,
  REPLY_QUALITY_TUNING,
  wouldReplySurviveParaphrase,
} from "./content-relevance";
import {
  classifyReplyWorthiness,
  pickReplyIntent,
} from "./content-reply-worthiness";
import { buildSemanticFallbackReply } from "./content-semantic-anchoring";

type Case = {
  name: string;
  run: () => void;
};

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

const cases: Case[] = [
  {
    name: "good parent-aware reply passes",
    run: () => {
      const parent = "Eval gates are how teams earn speed repeatedly. Weak baselines kill trust.";
      const reply = "Agreed on eval gates — we saw the same thing when our baseline was too loose.";
      const result = evaluateReplyRelevance({
        reply,
        isReply: true,
        parentExcerpt: parent,
        postExcerpt: "Ship speed is not the opposite of rigor.",
        threadExcerpts: [],
      });
      assert(result.pass, `expected pass, got score=${result.score} checks=${result.checks.join(",")}`);
    },
  },
  {
    name: "unrelated reply fails relevance",
    run: () => {
      const parent = "Eval gates are how teams earn speed repeatedly.";
      const reply =
        "Multi-agent orchestration across capability surfaces needs stronger signal alignment in the labor graph.";
      const result = evaluateReplyRelevance({
        reply,
        isReply: true,
        parentExcerpt: parent,
        postExcerpt: "Ship speed is not the opposite of rigor.",
        threadExcerpts: [],
      });
      assert(!result.pass, `expected fail for unrelated jargon reply, score=${result.score}`);
      assert(countJargonPhrases(reply).length >= 2, "expected jargon hits");
    },
  },
  {
    name: "jargon-heavy reply is penalized",
    run: () => {
      const reply = "The evaluation substrate and workflow primitives need better capability surfaces.";
      const jargon = countJargonPhrases(reply);
      assert(jargon.length >= 2, `expected jargon detection, got ${jargon.length}`);
      const result = evaluateReplyRelevance({
        reply,
        isReply: false,
        postExcerpt: "We tightened moderation hints and reduced false positives last week.",
        threadExcerpts: [],
      });
      assert(result.checks.some((check) => check.startsWith("jargon")), "expected jargon check");
      assert(!result.pass, "expected jargon reply to fail");
    },
  },
  {
    name: "thread-aware reply passes without repeating thread",
    run: () => {
      const thread = ["MTTC is a better leadership metric than vanity uptime screenshots."];
      const reply = "Co-signed — calm incident comms matter more than green dashboards.";
      assert(!isThreadRepetition(reply, thread), "reply should not count as repetition");
      const result = evaluateReplyRelevance({
        reply,
        isReply: true,
        parentExcerpt: thread[0]!,
        postExcerpt: "Queue lag looked scary, but stale retry jitter was the real bug.",
        threadExcerpts: thread,
      });
      assert(result.pass, `expected thread-aware pass, score=${result.score}`);
    },
  },
  {
    name: "repeated thread point fails",
    run: () => {
      const thread = ["MTTC is a better leadership metric than vanity uptime screenshots."];
      const reply = "MTTC beats vanity uptime screenshots every time for leadership signal.";
      assert(isThreadRepetition(reply, thread), "expected repetition detection");
      const result = evaluateReplyRelevance({
        reply,
        isReply: true,
        parentExcerpt: thread[0]!,
        postExcerpt: "Queue lag looked scary, but stale retry jitter was the real bug.",
        threadExcerpts: thread,
      });
      assert(result.checks.includes("thread_repetition"), "expected thread_repetition check");
    },
  },
  {
    name: "tunable threshold is exported",
    run: () => {
      assert(REPLY_QUALITY_TUNING.minPassScore > 0.5, "minPassScore should be above 0.5");
      assert(REPLY_QUALITY_TUNING.maxJargonHitsBeforeFail >= 1, "jargon threshold should be set");
    },
  },
  {
    name: "role-fit bullets parent extracts substantive topics",
    run: () => {
      const parent =
        "Role fit in 5 bullets: mission, failure modes, first 30 days, collaboration style, and what success looks like by month three.";
      const semantic = extractReplySemanticContext({
        parentExcerpt: parent,
        postExcerpt: "How we evaluate candidates for senior backend roles.",
        threadExcerpts: [],
        varietySeed: "test-seed",
      });
      assert(semantic.parent_topics.length >= 3, `expected topics, got ${semantic.parent_topics.join("|")}`);
      assert(
        semantic.parent_topics.some((topic) => /failure|success|30 day|collaboration|mission/i.test(topic)),
        `expected substantive topics, got ${semantic.parent_topics.join("|")}`,
      );
      assert(!semantic.parent_topics.some((topic) => /\bbullet/i.test(topic)), "topics should not include bullets");
    },
  },
  {
    name: "surface-level bullets reply is rejected",
    run: () => {
      const parent =
        "Role fit in 5 bullets: mission, failure modes, first 30 days, collaboration style, and what success looks like by month three.";
      const badReply =
        "Calling out bullets explicitly is harder than it looks — nice that Quinn didn't gloss over it.";
      const semantic = extractReplySemanticContext({
        parentExcerpt: parent,
        postExcerpt: "How we evaluate candidates for senior backend roles.",
        threadExcerpts: [],
      });
      assert(isSurfaceAnchoredReply(badReply, parent, semantic), "expected surface anchor detection");
      assert(!wouldReplySurviveParaphrase(badReply, semantic), "bad reply should fail paraphrase check");
      const result = evaluateReplyRelevance({
        reply: badReply,
        isReply: true,
        parentExcerpt: parent,
        postExcerpt: "How we evaluate candidates for senior backend roles.",
        threadExcerpts: [],
        semantic,
      });
      assert(!result.pass, `expected surface reply to fail, score=${result.score} checks=${result.checks.join(",")}`);
      assert(result.checks.includes("surface_anchor"), "expected surface_anchor check");
    },
  },
  {
    name: "meaning-aware role-fit replies pass semantic checks",
    run: () => {
      const parent =
        "Role fit in 5 bullets: mission, failure modes, first 30 days, collaboration style, and what success looks like by month three.";
      const semantic = extractReplySemanticContext({
        parentExcerpt: parent,
        postExcerpt: "How we evaluate candidates for senior backend roles.",
        threadExcerpts: [],
      });
      const goodReplies = [
        "The failure modes part is the most useful piece here. Most role descriptions skip where someone is likely to struggle.",
        "Success by month three is a good anchor. It makes the role easier to evaluate from both sides.",
        "I like the first-30-days framing because it turns a vague role into something testable.",
      ];
      for (const reply of goodReplies) {
        assert(!isSurfaceAnchoredReply(reply, parent, semantic), `should not be surface: ${reply}`);
        assert(wouldReplySurviveParaphrase(reply, semantic), `should survive paraphrase: ${reply}`);
        const result = evaluateReplyRelevance({
          reply,
          isReply: true,
          parentExcerpt: parent,
          postExcerpt: "How we evaluate candidates for senior backend roles.",
          threadExcerpts: [],
          semantic,
        });
        assert(result.pass, `expected pass for "${reply.slice(0, 40)}…", score=${result.score}`);
      }
    },
  },
  {
    name: "onboarding phrasing reply is rejected",
    run: () => {
      const parent =
        "First 30 days should cover onboarding expectations: who you meet, what you ship, and how success is measured.";
      const badReply = "Nice phrasing here — the way you laid out onboarding reads clearly.";
      const semantic = extractReplySemanticContext({
        parentExcerpt: parent,
        postExcerpt: "How we onboard senior engineers.",
        threadExcerpts: [],
      });
      const result = evaluateReplyRelevance({
        reply: badReply,
        isReply: true,
        parentExcerpt: parent,
        postExcerpt: "How we onboard senior engineers.",
        threadExcerpts: [],
        semantic,
      });
      assert(!result.pass, `expected phrasing reply to fail, score=${result.score}`);
      assert(result.checks.includes("surface_anchor"), "expected surface_anchor");
    },
  },
  {
    name: "job search uncertainty reply rejects generic orchestration",
    run: () => {
      const parent = "Not sure which roles fit me — backend vs platform vs infra is still fuzzy.";
      const badReply =
        "Multi-agent orchestration across capability surfaces needs stronger signal alignment in the labor graph.";
      const result = evaluateReplyRelevance({
        reply: badReply,
        isReply: true,
        parentExcerpt: parent,
        postExcerpt: "Job search check-in after a few months of interviews.",
        threadExcerpts: [],
      });
      assert(!result.pass, `expected unrelated orchestration reply to fail, score=${result.score}`);
    },
  },
  {
    name: "recruiter screening parent rejects unrelated feed signal reply",
    run: () => {
      const parent =
        "For recruiter screening I want evidence of ownership, not buzzwords — show me what you shipped and who relied on it.";
      const badReply = "The feed signal on trending posts is interesting for visibility loops this quarter.";
      const result = evaluateReplyRelevance({
        reply: badReply,
        isReply: true,
        parentExcerpt: parent,
        postExcerpt: "How we shortlist candidates for backend roles.",
        threadExcerpts: [],
      });
      assert(!result.pass, `expected unrelated feed reply to fail, score=${result.score}`);
    },
  },
  {
    name: "generic compliment is no_reply_target",
    run: () => {
      const worthiness = classifyReplyWorthiness({
        commentBody: "Great insight — love this!",
        postBody: "Eval gates are how teams earn speed repeatedly.",
        agentProfileText: "backend reliability platform engineering",
        authorAgentId: "author-1",
        replyingAgentId: "agent-1",
      });
      assert(worthiness.class === "no_reply_target", `expected no_reply_target, got ${worthiness.class}`);
    },
  },
  {
    name: "role-fit question is good_reply_target with intent",
    run: () => {
      const parent =
        "Role fit in 5 bullets: mission, failure modes, first 30 days, collaboration style, and what success looks like by month three.";
      const worthiness = classifyReplyWorthiness({
        commentBody: parent,
        postBody: "How we evaluate candidates for senior backend roles.",
        agentProfileText: "backend hiring failure modes onboarding",
        authorAgentId: "author-1",
        replyingAgentId: "agent-1",
      });
      assert(worthiness.class === "good_reply_target", `expected good_reply_target, got ${worthiness.class}`);
      const intent = pickReplyIntent({
        parentIntent: worthiness.parentIntent,
        objectiveMode: "recruiter",
        worthiness,
        varietySeed: "intent-test",
      });
      assert(
        ["recruiter_signal", "application_hiring_relevance", "ask_useful_follow_up"].includes(intent),
        `unexpected intent ${intent}`,
      );
    },
  },
  {
    name: "semantic fallback engages topic not formatting",
    run: () => {
      const parent =
        "Role fit in 5 bullets: mission, failure modes, first 30 days, collaboration style, and what success looks like by month three.";
      const semantic = extractReplySemanticContext({
        parentExcerpt: parent,
        postExcerpt: "How we evaluate candidates for senior backend roles.",
        threadExcerpts: [],
        varietySeed: "fallback-test",
      });
      const fallback = buildSemanticFallbackReply(semantic, "fallback-test");
      assert(Boolean(fallback), "expected semantic fallback");
      assert(!/\bbullet(s)?\b/i.test(fallback!), "fallback should not mention bullets");
      assert(!/\b(great point|this resonates|nice framework|strong insight)\b/i.test(fallback!), "no generic filler");
    },
  },
];

let passed = 0;
for (const testCase of cases) {
  testCase.run();
  passed += 1;
  console.log(`✓ ${testCase.name}`);
}

console.log(`\n${passed}/${cases.length} content-relevance checks passed.`);
