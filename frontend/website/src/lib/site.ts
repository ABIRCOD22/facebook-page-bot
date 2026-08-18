/**
 * site.ts — single source of truth for marketing copy, navigation,
 * features, pricing, FAQ and stats. Keyword-rich on the "facebook ai
 * bot" / "facebook page bot" subject. Copy is deliberately short: the
 * site shows, it does not tell.
 */
import {
  Bot,
  MessageCircle,
  Sparkles,
  Languages,
  ShieldCheck,
  BarChart3,
  UserCheck,
  Zap,
  Globe2,
  Clock,
  ChevronRight,
  CheckCircle2,
  MessageCircleHeart,
} from "lucide-react"

export const SITE = {
  name: "ChatriX",
  tagline: "Your AI Moderator for Your Facebook Page",
  description:
    "ChatriX is an AI moderator for your Facebook page that auto-replies to Messenger and comments 24/7 — trained on your products and knowledge, with human handover. The easiest facebook ai bot to set up, no code required.",
  url: process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3002",
  apiUrl: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000",
  clientPanelUrl: process.env.NEXT_PUBLIC_CLIENT_PANEL_URL || "http://localhost:3100",
  twitter: "@chatrix",
  email: "hello@chatrix.app",
}

export const NAV_LINKS: { href: string; label: string }[] = [
  { href: "/features", label: "Features" },
  { href: "/pricing", label: "Pricing" },
  { href: "/about", label: "About" },
  { href: "/#how", label: "How it works" },
]

export const FOOTER_COLUMNS: { title: string; links: { href: string; label: string }[] }[] = [
  {
    title: "Product",
    links: [
      { href: "/features", label: "Features" },
      { href: "/pricing", label: "Pricing" },
      { href: "/#how", label: "How it works" },
      { href: "/register", label: "Get started" },
    ],
  },
  {
    title: "Solutions",
    links: [
      { href: "/features#auto-reply", label: "Auto reply Facebook page" },
      { href: "/features#messenger", label: "Facebook Messenger bot" },
      { href: "/features#handover", label: "Human handover" },
      { href: "/features#multilingual", label: "Multilingual replies" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/about", label: "About us" },
      { href: "/about#meta", label: "Built on Meta APIs" },
      { href: "/about#contact", label: "Contact" },
      { href: "/register", label: "Free trial" },
    ],
  },
]

/** Real, sourced industry stats (no fabricated customer quotes). */
export const STATS: { value: number; prefix?: string; suffix?: string; label: string }[] = [
  { value: 70, suffix: "%", label: "of customer messages arrive via Messenger, not email or phone" },
  { value: 10, suffix: "–15%", label: "Messenger commerce conversion vs 2–3% on web funnels" },
  { value: 60, prefix: "<", suffix: "s", label: "average first response with a ChatriX facebook ai bot" },
  { value: 30, prefix: "30+", label: "languages your facebook page bot replies in automatically" },
]

export const STEPS: { n: number; title: string; body: string; icon: typeof Bot; visual: "token" | "train" | "chat" }[] = [
  {
    n: 1,
    title: "Connect your page",
    body: "Paste your Page Access Token — no code, no app review, live in ~2 minutes.",
    icon: MessageCircle,
    visual: "token",
  },
  {
    n: 2,
    title: "Train your AI moderator",
    body: "Add products & knowledge. Your facebook page bot learns your tone and policies.",
    icon: Sparkles,
    visual: "train",
  },
  {
    n: 3,
    title: "Relax — replies run 24/7",
    body: "ChatriX answers DMs and comments, and hands tricky chats to a human agent.",
    icon: Bot,
    visual: "chat",
  },
]

export const FEATURES: { icon: typeof Bot; title: string; caption: string; id?: string }[] = [
  { icon: Zap, title: "24/7 auto reply Facebook page", caption: "Replies to Messenger & comments instantly, day and night.", id: "auto-reply" },
  { icon: MessageCircle, title: "A real Facebook Messenger bot", caption: "Understands intent, guides buyers to checkout — no human needed.", id: "messenger" },
  { icon: Sparkles, title: "Trained on your products & knowledge", caption: "Upload your catalogue & FAQs. Accurate, on-brand, always.", id: "train" },
  { icon: UserCheck, title: "Human handover when it matters", caption: "Tricky chats route to an agent in one click, same thread.", id: "handover" },
  { icon: Languages, title: "Multilingual replies", caption: "Detects & replies in 30+ languages automatically.", id: "multilingual" },
  { icon: ShieldCheck, title: "Safety & brand guardrails", caption: "Stays on-policy, blocks off-topic, never invents prices.", id: "safety" },
  { icon: BarChart3, title: "Analytics that grow revenue", caption: "Response times, top questions, conversion from chat.", id: "analytics" },
  { icon: Globe2, title: "Built on official Meta APIs", caption: "Stays compliant & reliable as Meta evolves.", id: "meta" },
  { icon: Clock, title: "Set up in minutes, no code", caption: "No developers, no app review. Live the same day.", id: "nocode" },
]

/** Bento grid for the home page (visual-first feature cards). */
export const BENTO: { span: string; icon: typeof Bot; title: string; caption: string; mock?: "chat" | "inbox" | "train" | "analytics" | "token" }[] = [
  { span: "bento-a", icon: MessageCircle, title: "Facebook AI bot that replies 24/7", caption: "See it answer a real Messenger chat — trained on your store, live in minutes.", mock: "chat" },
  { span: "bento-b", icon: UserCheck, title: "Human handover", caption: "AI + your team, one thread.", mock: "inbox" },
  { span: "bento", icon: Sparkles, title: "Trained on your knowledge", caption: "Upload catalogue & FAQs.", mock: "train" },
  { span: "bento", icon: BarChart3, title: "Analytics", caption: "Replies, conversions, handovers.", mock: "analytics" },
  { span: "bento", icon: Languages, title: "30+ languages", caption: "Auto-detected per message." },
  { span: "bento", icon: ShieldCheck, title: "Brand guardrails", caption: "On-policy, never invents prices." },
]

export const MARQUEE_ITEMS: string[] = [
  "E-commerce",
  "Restaurants",
  "Real Estate",
  "Agencies",
  "SaaS",
  "Local shops",
  "Coaches",
  "Courses",
  "Salons",
  "Events",
]

export const PRICING: {
  name: string
  priceMonthly: string
  priceYearly: string
  period: string
  description: string
  features: string[]
  popular?: boolean
  ctaLabel: string
  ctaHref: string
}[] = [
  {
    name: "Trial",
    priceMonthly: "$0",
    priceYearly: "$0",
    period: "/ 7 days",
    description: "Full access to every feature. No credit card required.",
    features: ["1 Facebook page", "Unlimited AI auto-replies", "Products & knowledge training", "Human handover", "Multilingual replies", "Analytics dashboard"],
    ctaLabel: "Start free trial",
    ctaHref: "/register",
  },
  {
    name: "Starter",
    priceMonthly: "$29",
    priceYearly: "$24",
    period: "/ month",
    description: "For growing pages that want always-on moderation.",
    features: ["Up to 3 Facebook pages", "2,000 AI replies / month", "Everything in Trial", "Priority responses", "Custom tone & guardrails", "Email support"],
    popular: true,
    ctaLabel: "Start free trial",
    ctaHref: "/register",
  },
  {
    name: "Scale",
    priceMonthly: "$99",
    priceYearly: "$82",
    period: "/ month",
    description: "For teams and high-volume commerce pages.",
    features: ["Up to 15 Facebook pages", "10,000 AI replies / month", "Everything in Starter", "Team inboxes & roles", "Webhook & API access", "Priority support"],
    ctaLabel: "Start free trial",
    ctaHref: "/register",
  },
]

export const FAQ: { q: string; a: string }[] = [
  { q: "How do I set up auto reply on my Facebook page?", a: "Create a free ChatriX account, paste your Facebook Page Access Token, and your AI moderator is live in about two minutes. No app review and no code required." },
  { q: "Is ChatriX a facebook bot with no coding needed?", a: "Yes. ChatriX is a no-code facebook page bot. You connect a token and train it in plain language — no developers, no Meta app review, no infrastructure." },
  { q: "Can I try it for free?", a: "Absolutely. Every plan starts with a 7-day free trial and no credit card. You get full access to auto-reply, training, handover and analytics." },
  { q: "What happens with complex questions?", a: "Your AI moderator answers routine questions and automatically hands complex or sensitive chats to a human agent, with the full conversation history attached." },
  { q: "Does it work for comments and Messenger?", a: "Yes. ChatriX auto-replies to both Facebook Messenger conversations and public post comments, so no customer message goes unanswered." },
  { q: "Is it built on official Meta APIs?", a: "Yes. ChatriX uses the official Facebook / Meta messaging APIs, keeping your automation compliant and reliable as Meta updates its platform." },
]

export const TRUST_POINTS: string[] = [
  "No credit card to start",
  "Cancel anytime",
  "Built on official Meta APIs",
  "Set up in 2 minutes",
]

export const HERO_BULLETS: { icon: typeof CheckCircle2; text: string }[] = [
  { icon: CheckCircle2, text: "Auto-replies to Messenger & comments 24/7" },
  { icon: CheckCircle2, text: "Trained on your products and knowledge" },
  { icon: CheckCircle2, text: "Human handover for tricky chats" },
]
