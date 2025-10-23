/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react/no-unescaped-entities */
'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePostHog } from 'posthog-js/react'
import {
  Shield,
  Zap,
  FileText,
  Users,
  Database,
  Search,
  Globe,
  Bot,
  CheckCircle,
  Briefcase,
  Heart,
  Code,
  Smartphone,
} from 'lucide-react'

// Translation messages - import directly
import enMessages from '@/messages/en.json'
import frMessages from '@/messages/fr.json'
import nlMessages from '@/messages/nl.json'

const translations = {
  en: enMessages,
  fr: frMessages,
  nl: nlMessages,
}

// Translation hook
function useTranslations(locale: string) {
  const [messages, setMessages] = useState<any>(null)

  useEffect(() => {
    const msgs = translations[locale as keyof typeof translations]
    if (msgs) {
      setMessages(msgs)
    }
  }, [locale])

  const t = (key: string) => {
    if (!messages) return key
    const keys = key.split('.')
    let value = messages
    for (const k of keys) {
      value = value?.[k]
      if (!value) return key
    }
    return value
  }

  return { t, messages }
}

// Demo examples with translations
const getDemoExamples = (locale: string) => [
  {
    id: 'contract',
    category: 'Legal',
    categoryKey: 'demo.categories.legal',
    icon: FileText,
    query:
      locale === 'fr'
        ? 'Quels sont les termes de paiement dans le contrat fournisseur ?'
        : locale === 'nl'
          ? 'Wat zijn de betalingsvoorwaarden in de leveranciersovereenkomst?'
          : 'What are the payment terms in the supplier agreement?',
    answer:
      locale === 'fr'
        ? "Selon le contrat fournisseur, les conditions de paiement sont <strong>Net 30 jours</strong> à partir de la date de facturation. Une remise de 2% pour paiement anticipé est disponible si payé sous 10 jours. Les retards de paiement entraînent des frais d'intérêt de 1,5% par mois."
        : locale === 'nl'
          ? 'Volgens de leveranciersovereenkomst zijn de betalingsvoorwaarden <strong>Netto 30 dagen</strong> vanaf factuurdatum. Een vroegbetalingskorting van 2% is beschikbaar bij betaling binnen 10 dagen. Late betalingen brengen 1,5% maandelijkse rente met zich mee.'
          : 'According to the supplier agreement, payment terms are <strong>Net 30 days</strong> from invoice date. A 2% early payment discount is available if paid within 10 days. Late payments incur a 1.5% monthly interest charge.',
    sources: [
      {
        file: 'Supplier_Agreement_2024.pdf',
        page: 7,
        excerpt: '5.2 Payment Terms: All invoices shall be paid within',
        highlight: 'thirty (30) days of invoice date',
        excerpt2: '. Early payment discount of',
        highlight2: '2% applies if paid within 10 days',
        excerpt3: '.',
      },
      {
        file: 'Supplier_Agreement_2024.pdf',
        page: 8,
        excerpt:
          '5.3 Late Payment: Any payment not received by the due date will incur',
        highlight: 'interest charges of 1.5% per month',
        excerpt2: 'on the outstanding balance.',
      },
    ],
  },
  {
    id: 'hr',
    category: 'HR',
    categoryKey: 'demo.categories.hr',
    icon: Heart,
    query:
      locale === 'fr'
        ? 'Combien de jours de congé ai-je si un membre de ma famille est malade ?'
        : locale === 'nl'
          ? 'Hoeveel dagen verlof krijg ik als een familielid ziek is?'
          : 'How many days of leave do I get if a family member is sick?',
    answer:
      locale === 'fr'
        ? "Selon la politique de l'entreprise, les employés ont droit à <strong>5 jours de congé compassionnel payé</strong> par an lorsqu'un membre de la famille immédiate (conjoint, enfant, parent) est gravement malade. Un congé non payé supplémentaire peut être accordé avec l'approbation du manager."
        : locale === 'nl'
          ? 'Volgens het bedrijfsbeleid hebben werknemers recht op <strong>5 dagen betaald compassieverlof</strong> per jaar wanneer een direct familielid (echtgenoot, kind, ouder) ernstig ziek is. Aanvullend onbetaald verlof kan worden verleend met toestemming van de manager.'
          : 'According to company policy, employees are entitled to <strong>5 days of paid compassionate leave</strong> per year when an immediate family member (spouse, child, parent) is seriously ill. Additional unpaid leave may be granted upon manager approval.',
    sources: [
      {
        file: 'Employee_Handbook_2024.pdf',
        page: 23,
        excerpt: 'Section 6.4 - Compassionate Leave: Employees may take up to',
        highlight: 'five (5) days of paid leave per calendar year',
        excerpt2:
          'when caring for an immediate family member with a serious health condition.',
      },
      {
        file: 'Employee_Handbook_2024.pdf',
        page: 24,
        excerpt: 'Immediate family members are defined as',
        highlight: 'spouse, domestic partner, children, parents, and siblings',
        excerpt2:
          '. Extended family leave requests may be approved at management discretion.',
      },
    ],
  },
  {
    id: 'tech',
    category: 'IT',
    categoryKey: 'demo.categories.tech',
    icon: Code,
    query:
      locale === 'fr'
        ? "Quelle est la limite de taux API pour le service d'authentification ?"
        : locale === 'nl'
          ? 'Wat is de API rate limit voor de authenticatiedienst?'
          : 'What is our API rate limit for the authentication service?',
    answer:
      locale === 'fr'
        ? "L'API du service d'authentification a une limite de <strong>100 requêtes par minute par adresse IP</strong> pour les utilisateurs standard et <strong>1000 requêtes par minute</strong> pour le niveau premium. Les en-têtes de limite de taux sont inclus dans toutes les réponses. Contactez DevOps pour les limites enterprise."
        : locale === 'nl'
          ? 'De authenticatie-service API heeft een limiet van <strong>100 verzoeken per minuut per IP-adres</strong> voor standaard gebruikers en <strong>1000 verzoeken per minuut</strong> voor premium tier. Rate limit headers zijn opgenomen in alle responses. Neem contact op met DevOps voor enterprise limieten.'
          : 'The authentication service API has a rate limit of <strong>100 requests per minute per IP address</strong> for standard users and <strong>1000 requests per minute</strong> for premium tier. Rate limit headers are included in all responses. Contact DevOps for enterprise limits.',
    sources: [
      {
        file: 'API_Documentation_v3.2.md',
        page: 12,
        excerpt: 'Auth Service Rate Limits: Standard tier:',
        highlight: '100 req/min per IP',
        excerpt2: ', Premium tier:',
        highlight2: '1000 req/min per IP',
        excerpt3: '. Enterprise custom limits available.',
      },
      {
        file: 'Infrastructure_Guidelines.pdf',
        page: 45,
        excerpt: 'All API responses include rate limit headers:',
        highlight:
          'X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset',
        excerpt2: '. Implement exponential backoff for 429 responses.',
      },
    ],
  },
]

function DemoCard({
  example,
  t,
}: {
  example: ReturnType<typeof getDemoExamples>[0]
  t: (key: string) => string
}) {
  const [step, setStep] = useState(0)
  const [query, setQuery] = useState('')
  const fullQuery = example.query

  useEffect(() => {
    const timer = setTimeout(
      () => {
        if (step === 0 && query.length < fullQuery.length) {
          setQuery(fullQuery.slice(0, query.length + 1))
        } else if (step === 0 && query.length === fullQuery.length) {
          setTimeout(() => setStep(1), 500)
        } else if (step === 1) {
          setTimeout(() => setStep(2), 1500)
        }
      },
      step === 0 ? 40 : 0
    )

    return () => clearTimeout(timer)
  }, [step, query, fullQuery])

  const ExampleIcon = example.icon

  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-lg flex flex-col h-full">
      {/* Category */}
      <div className="mb-3 flex items-center gap-2">
        <ExampleIcon className="h-4 w-4 text-accent" />
        <span className="text-xs font-semibold text-accent">
          {t(example.categoryKey)}
        </span>
      </div>

      {/* Query */}
      <div className="mb-4">
        <div className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground min-h-[60px]">
          {query}
          {step === 0 && <span className="animate-pulse">|</span>}
        </div>
      </div>

      {/* Results */}
      {step === 2 ? (
        <div className="space-y-3 flex-1 animate-in fade-in duration-500">
          {/* AI Answer */}
          <div className="rounded-lg border border-accent/30 bg-accent/5 p-3">
            <h3 className="mb-1 flex items-center gap-1 text-xs font-semibold text-accent">
              <Zap className="h-3 w-3" />
              {t('demo.aiAnswer')}
            </h3>
            <p
              className="text-xs leading-relaxed text-foreground"
              dangerouslySetInnerHTML={{ __html: example.answer }}
            />
          </div>

          {/* Sources */}
          <div className="space-y-1">
            <h3 className="text-xs font-semibold text-muted-foreground">
              {t('demo.sources')}
            </h3>
            {example.sources.slice(0, 1).map((source, idx) => (
              <div
                key={idx}
                className="rounded border border-border bg-background p-2"
              >
                <div className="mb-1 flex items-start justify-between">
                  <div className="flex items-center gap-1">
                    <FileText className="h-3 w-3 text-primary" />
                    <span className="text-xs font-medium truncate">
                      {source.file}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    p.{source.page}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                  {source.excerpt}{' '}
                  <mark className="bg-accent/30 px-0.5">
                    {source.highlight}
                  </mark>
                  {source.excerpt2}
                </p>
              </div>
            ))}
            {example.sources.length > 1 && (
              <p className="text-xs text-accent">
                +{example.sources.length - 1} more sources
              </p>
            )}
          </div>
        </div>
      ) : step === 1 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex items-center gap-2 text-secondary">
            <Search className="h-4 w-4 animate-spin" />
            <span className="text-sm font-medium">{t('demo.searching')}</span>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function AIAgentsCatalog({
  t,
  trackClick,
}: {
  t: (key: string) => string
  trackClick: (eventName: string, properties?: Record<string, any>) => void
}) {
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null)
  const [agentStep, setAgentStep] = useState(0)
  const [agentQuery, setAgentQuery] = useState('')
  const fullAgentQuery =
    "Le juge des référés peut-il ordonner la passation d'un acte authentique de vente ?"

  const agents = [
    {
      id: 'lawyer',
      name: 'Legal Expert',
      nameFr: 'Expert Juridique',
      nameNl: 'Juridische Expert',
      icon: Briefcase,
      gradient: 'from-pink-500 to-purple-600',
      color: 'text-pink-600',
      bgColor: 'bg-gradient-to-br from-pink-50 to-purple-50',
      description:
        'Analyzes contracts, case law, and legal documents with expert precision',
      descriptionFr:
        'Analyse les contrats, la jurisprudence et les documents juridiques avec une précision experte',
      descriptionNl:
        'Analyseert contracten, rechtspraak en juridische documenten met expertprecisie',
      features: [
        'Contract Analysis',
        'Jurisprudence Research',
        'Legal Citations',
        'Compliance Checks',
      ],
    },
    {
      id: 'hr',
      name: 'HR Specialist',
      nameFr: 'Spécialiste RH',
      nameNl: 'HR Specialist',
      icon: Heart,
      gradient: 'from-teal-500 to-emerald-600',
      color: 'text-teal-600',
      bgColor: 'bg-gradient-to-br from-teal-50 to-emerald-50',
      description:
        'Handles employee handbooks, policies, benefits, and HR regulations',
      descriptionFr:
        'Gère les manuels employés, politiques, avantages et réglementations RH',
      descriptionNl:
        'Behandelt werknemershandboeken, beleid, voordelen en HR-regelgeving',
      features: [
        'Policy Lookup',
        'Benefits Guide',
        'Leave Management',
        'Onboarding',
      ],
    },
    {
      id: 'tech',
      name: 'Developer Docs',
      nameFr: 'Docs Développeur',
      nameNl: 'Ontwikkelaar Docs',
      icon: Code,
      gradient: 'from-blue-500 to-indigo-600',
      color: 'text-blue-600',
      bgColor: 'bg-gradient-to-br from-blue-50 to-indigo-50',
      description:
        'Navigates technical documentation, APIs, architecture, and code standards',
      descriptionFr:
        'Navigate dans la documentation technique, APIs, architecture et standards de code',
      descriptionNl:
        'Navigeert door technische documentatie, APIs, architectuur en codestandaarden',
      features: [
        'API References',
        'Code Examples',
        'Architecture Guides',
        'Best Practices',
      ],
    },
    {
      id: 'finance',
      name: 'Finance Advisor',
      nameFr: 'Conseiller Financier',
      nameNl: 'Financieel Adviseur',
      icon: Database,
      gradient: 'from-orange-500 to-red-600',
      color: 'text-orange-600',
      bgColor: 'bg-gradient-to-br from-orange-50 to-red-50',
      description:
        'Analyzes financial reports, budgets, compliance, and accounting standards',
      descriptionFr:
        'Analyse les rapports financiers, budgets, conformité et normes comptables',
      descriptionNl:
        'Analyseert financiële rapporten, budgetten, compliance en boekhoudnormen',
      features: [
        'Report Analysis',
        'Budget Planning',
        'Tax Compliance',
        'Audit Support',
      ],
    },
    {
      id: 'sales',
      name: 'Sales Enablement',
      nameFr: 'Aide à la Vente',
      nameNl: 'Verkoopondersteuning',
      icon: Users,
      gradient: 'from-green-500 to-lime-600',
      color: 'text-green-600',
      bgColor: 'bg-gradient-to-br from-green-50 to-lime-50',
      description:
        'Product specs, pricing, competitive analysis, and sales playbooks',
      descriptionFr:
        'Spécifications produits, tarification, analyse concurrentielle et guides de vente',
      descriptionNl:
        'Productspecificaties, prijzen, concurrentieanalyse en verkoophandboeken',
      features: [
        'Product Info',
        'Pricing Lookup',
        'Competitor Intel',
        'Sales Scripts',
      ],
    },
    {
      id: 'compliance',
      name: 'Compliance Monitor',
      nameFr: 'Moniteur Conformité',
      nameNl: 'Compliance Monitor',
      icon: Shield,
      gradient: 'from-violet-500 to-purple-600',
      color: 'text-violet-600',
      bgColor: 'bg-gradient-to-br from-violet-50 to-purple-50',
      description:
        'GDPR, industry regulations, internal policies, and audit requirements',
      descriptionFr:
        "RGPD, réglementations sectorielles, politiques internes et exigences d'audit",
      descriptionNl: 'AVG, brancheregelgeving, intern beleid en auditvereisten',
      features: [
        'GDPR Checks',
        'Regulation Updates',
        'Policy Compliance',
        'Audit Trails',
      ],
    },
  ]

  useEffect(() => {
    if (selectedAgent !== 'lawyer') {
      setAgentStep(0)
      setAgentQuery('')
      return
    }

    const timer = setTimeout(
      () => {
        if (agentStep === 0 && agentQuery.length < fullAgentQuery.length) {
          setAgentQuery(fullAgentQuery.slice(0, agentQuery.length + 1))
        } else if (
          agentStep === 0 &&
          agentQuery.length === fullAgentQuery.length
        ) {
          setTimeout(() => setAgentStep(1), 500)
        } else if (agentStep === 1) {
          setTimeout(() => setAgentStep(2), 2000)
        }
      },
      agentStep === 0 ? 50 : 0
    )

    return () => clearTimeout(timer)
  }, [selectedAgent, agentStep, agentQuery])

  return (
    <div className="mx-auto max-w-7xl">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl mb-4">
          {t('aiAgents.catalog.title')}
        </h2>
        <p className="text-lg text-muted-foreground">
          {t('aiAgents.catalog.subtitle')}
        </p>
      </div>

      {/* Scrollable Agent Catalog */}
      <div className="relative mb-12">
        {/* Gradient Fade on edges */}
        <div className="absolute left-0 top-0 bottom-0 w-20 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-20 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />

        {/* Scrollable Container with Infinite Loop */}
        <div
          className="overflow-x-auto pb-4 scrollbar-hide scroll-smooth"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          ref={(el) => {
            if (!el) return
            let scrollInterval: NodeJS.Timeout

            const scroll = () => {
              if (el.scrollLeft >= el.scrollWidth / 2) {
                el.scrollLeft = 0
              } else {
                el.scrollLeft += 1
              }
            }

            scrollInterval = setInterval(scroll, 30)

            el.addEventListener('mouseenter', () =>
              clearInterval(scrollInterval)
            )
            el.addEventListener('mouseleave', () => {
              scrollInterval = setInterval(scroll, 30)
            })

            return () => clearInterval(scrollInterval)
          }}
        >
          <div className="flex gap-4 px-4 min-w-min">
            {/* Duplicate agents array for infinite scroll effect */}
            {[...agents, ...agents].map((agent, index) => {
              const AgentIcon = agent.icon
              const isSelected = selectedAgent === agent.id

              return (
                <button
                  key={`${agent.id}-${index}`}
                  onClick={() => {
                    const newAgent =
                      agent.id === selectedAgent ? null : agent.id
                    setSelectedAgent(newAgent)
                    if (newAgent) {
                      trackClick('agent_selected', {
                        agent_type: agent.id,
                        agent_name: agent.name,
                      })
                    }
                  }}
                  className={`flex-shrink-0 w-80 rounded-2xl ${agent.bgColor} border-2 ${
                    isSelected
                      ? 'border-accent shadow-2xl scale-105'
                      : 'border-border/50 hover:border-border'
                  } p-6 text-left transition-all duration-300 hover:shadow-xl group`}
                >
                  {/* Header with Icon and Badge */}
                  <div className="flex items-start justify-between mb-4">
                    <div
                      className={`p-3 rounded-xl bg-gradient-to-br ${agent.gradient} shadow-lg group-hover:scale-110 transition-transform`}
                    >
                      <AgentIcon className="h-6 w-6 text-white" />
                    </div>
                    {isSelected && (
                      <div className="flex items-center gap-1 bg-accent text-accent-foreground px-2 py-1 rounded-full text-xs font-semibold">
                        <CheckCircle className="h-3 w-3" />
                        Active
                      </div>
                    )}
                  </div>

                  {/* Agent Name */}
                  <h3 className="text-xl font-bold mb-2 text-foreground">
                    {agent.name}
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                    {agent.description}
                  </p>

                  {/* Features Grid */}
                  <div className="grid grid-cols-2 gap-2 mb-4">
                    {agent.features.map((feature) => (
                      <div
                        key={feature}
                        className="flex items-center gap-1 text-xs"
                      >
                        <div
                          className={`w-1 h-1 rounded-full bg-gradient-to-r ${agent.gradient}`}
                        />
                        <span className="text-muted-foreground truncate">
                          {feature}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Try It Badge */}
                  <div className="mt-4 pt-4 border-t border-border/50">
                    <div
                      className={`text-xs font-semibold ${agent.color} flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity`}
                    >
                      <span>Click to try →</span>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Scroll Indicator */}
        <div className="flex justify-center gap-1 mt-4">
          {agents.map((agent) => (
            <div
              key={agent.id}
              className={`h-1 rounded-full transition-all ${
                selectedAgent === agent.id
                  ? 'w-8 bg-accent'
                  : 'w-1 bg-muted-foreground/30'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Lawyer Agent Demo */}
      {selectedAgent === 'lawyer' && (
        <div className="rounded-lg border border-border bg-card p-6 shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="mb-4 flex items-center gap-2 text-accent">
            <Briefcase className="h-5 w-5" />
            <span className="font-semibold">
              Lawyer Agent - Legal Research Demo
            </span>
          </div>

          {/* Query */}
          <div className="mb-6">
            <div className="flex gap-2">
              <div className="flex-1 rounded-md border border-input bg-background px-4 py-3 text-foreground min-h-[48px]">
                {agentQuery}
                {agentStep === 0 && <span className="animate-pulse">|</span>}
              </div>
              <button
                className={`rounded-md px-6 py-3 font-semibold transition ${
                  agentStep === 1
                    ? 'bg-accent/50 text-accent-foreground'
                    : 'bg-accent text-accent-foreground'
                }`}
              >
                {agentStep === 1 ? (
                  <span className="flex items-center gap-2">
                    <Search className="h-4 w-4 animate-spin" />
                    Analyzing...
                  </span>
                ) : (
                  'Research'
                )}
              </button>
            </div>
          </div>

          {/* Results */}
          {agentStep === 2 && (
            <div className="space-y-4 animate-in fade-in duration-500">
              {/* Comprehensive Answer */}
              <div className="rounded-lg border border-accent/30 bg-accent/5 p-6">
                <h3 className="mb-3 flex items-center gap-2 text-base font-semibold text-accent">
                  <Zap className="h-5 w-5" />
                  Réponse Synthétique
                </h3>
                <p className="text-sm leading-relaxed text-foreground mb-4">
                  Le juge des référés peut, sauf exceptions, ordonner
                  l'exécution en nature d'une obligation, y compris la passation
                  d'un acte authentique, pour autant que{' '}
                  <strong>
                    le droit invoqué ne soit pas sérieusement contestable
                  </strong>{' '}
                  et en présence d'une <strong>situation d'urgence</strong>.
                  Cependant, en matière d'actes authentiques, une exception
                  importante existe lorsque la loi impose une forme solennelle
                  particulière (actes authentiques notariés), ce qui limite la
                  compétence du juge des référés.
                </p>

                <div className="space-y-3 text-sm">
                  <div>
                    <h4 className="font-semibold text-foreground mb-2">
                      ✓ Fondements et conditions
                    </h4>
                    <ul className="space-y-2 text-muted-foreground ml-4">
                      <li>
                        • Le juge des référés peut ordonner l'exécution forcée
                        en nature d'un engagement
                      </li>
                      <li>
                        • Exemple: Bruxelles, 24 avril 1990 - réintégration et
                        passation d'acte ordonnées
                      </li>
                      <li>
                        • Condition: droit non sérieusement contesté et urgence
                        établie
                      </li>
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-semibold text-foreground mb-2">
                      ⚠️ Limites légales
                    </h4>
                    <ul className="space-y-2 text-muted-foreground ml-4">
                      <li>
                        • Le juge ne peut se substituer au notaire pour actes
                        authentiques obligatoires
                      </li>
                      <li>
                        • Respect des formes solennelles imposées par la loi
                        (ex: vente immobilière)
                      </li>
                      <li>
                        • Cassation: interdiction d'empiéter sur prérogatives
                        notariales
                      </li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Sources */}
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Sources Juridiques (6 documents)
                </h3>

                <div className="grid gap-2">
                  <div className="rounded-lg border border-border bg-background p-3 hover:border-accent/50 transition">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-accent" />
                        <span className="text-sm font-medium">
                          vancompernolle-proceduresrefere-1998.pdf
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        p. 156
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Le juge peut ordonner{' '}
                      <mark className="bg-accent/30 px-1">
                        la passation en nature d'un acte authentique
                      </mark>
                      non sérieusement contesté. Bruxelles, 24 avril 1990,
                      J.L.M.B., 1991, p. 98.
                    </p>
                  </div>

                  <div className="rounded-lg border border-border bg-background p-3 hover:border-accent/50 transition">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-accent" />
                        <span className="text-sm font-medium">
                          dirix-beslagexecutierecht-2001.pdf
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        p. 234
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Limites:{' '}
                      <mark className="bg-accent/30 px-1">
                        le juge ne peut remplacer un acte notarié obligatoire
                      </mark>
                      par son jugement, sauf dérogation légale expresse. Respect
                      des compétences notariales.
                    </p>
                  </div>

                  <div className="rounded-lg border border-border bg-background p-3 hover:border-accent/50 transition">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-accent" />
                        <span className="text-sm font-medium">
                          1999-059.pdf
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        p. 12
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Le juge des référés peut{' '}
                      <mark className="bg-accent/30 px-1">
                        condamner à l'exécution forcée d'une obligation
                      </mark>
                      , y compris la passation d'acte authentique, sous
                      conditions d'urgence et de clarté du droit.
                    </p>
                  </div>
                </div>

                <button className="mt-2 text-xs text-accent hover:underline font-medium">
                  Voir les 3 autres sources →
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {selectedAgent && selectedAgent !== 'lawyer' && (
        <div className="rounded-lg border border-border bg-card p-12 text-center">
          <Bot className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">
            {selectedAgent === 'hr' && 'HR Assistant demo coming soon...'}
            {selectedAgent === 'tech' &&
              'Tech Documentation agent demo coming soon...'}
          </p>
        </div>
      )}
    </div>
  )
}

export default function LandingPage() {
  const posthog = usePostHog()
  const [locale, setLocale] = useState(() => {
    if (typeof window !== 'undefined') {
      const browserLang = navigator.language.split('-')[0]
      return ['en', 'fr', 'nl'].includes(browserLang) ? browserLang : 'en'
    }
    return 'en'
  })
  const { t, messages } = useTranslations(locale)

  // Track language changes
  useEffect(() => {
    if (posthog) {
      posthog.capture('language_changed', {
        locale,
        page: 'landing',
      })
    }
  }, [locale, posthog])

  // Helper function to track clicks
  const trackClick = (eventName: string, properties?: Record<string, any>) => {
    if (posthog) {
      posthog.capture(eventName, {
        page: 'landing',
        ...properties,
      })
    }
  }

  // Track scroll depth
  useEffect(() => {
    if (!posthog) return

    let maxScrollDepth = 0
    const handleScroll = () => {
      const scrollPercentage = Math.round(
        (window.scrollY /
          (document.documentElement.scrollHeight - window.innerHeight)) *
          100
      )

      if (scrollPercentage > maxScrollDepth) {
        maxScrollDepth = scrollPercentage

        // Track milestones
        if (scrollPercentage >= 25 && maxScrollDepth < 50) {
          posthog.capture('scroll_depth', { depth: '25%', page: 'landing' })
        } else if (scrollPercentage >= 50 && maxScrollDepth < 75) {
          posthog.capture('scroll_depth', { depth: '50%', page: 'landing' })
        } else if (scrollPercentage >= 75 && maxScrollDepth < 100) {
          posthog.capture('scroll_depth', { depth: '75%', page: 'landing' })
        } else if (scrollPercentage >= 90) {
          posthog.capture('scroll_depth', { depth: '100%', page: 'landing' })
        }
      }
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [posthog])

  if (!messages) return null

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="border-b border-border bg-card/50 backdrop-blur sticky top-0 z-50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center">
              <Image
                src="/docuralis.png"
                alt="Docuralis"
                width={132}
                height={132}
                className="h-13 w-auto"
              />
            </div>
            <div className="hidden md:flex items-center space-x-8">
              <a
                href="#features"
                onClick={() => trackClick('nav_click', { section: 'features' })}
                className="text-muted-foreground hover:text-foreground transition"
              >
                {t('nav.features')}
              </a>
              <a
                href="#agents"
                onClick={() => trackClick('nav_click', { section: 'agents' })}
                className="text-muted-foreground hover:text-foreground transition"
              >
                {t('nav.agents')}
              </a>
              <a
                href="#pricing"
                onClick={() => trackClick('nav_click', { section: 'pricing' })}
                className="text-muted-foreground hover:text-foreground transition"
              >
                {t('nav.pricing')}
              </a>
              <Link
                href="/login"
                onClick={() =>
                  trackClick('nav_login_click', { location: 'navbar' })
                }
                className="text-muted-foreground hover:text-foreground transition"
              >
                {t('nav.login')}
              </Link>

              {/* Language Selector */}
              <div className="flex items-center gap-2 border-l border-border pl-4">
                <Globe className="h-4 w-4 text-muted-foreground" />
                <select
                  value={locale}
                  onChange={(e) => setLocale(e.target.value)}
                  className="rounded-md border border-input bg-background px-2 py-1 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer"
                >
                  <option value="en">EN</option>
                  <option value="fr">FR</option>
                  <option value="nl">NL</option>
                </select>
              </div>

              <Link
                href="/register"
                onClick={() =>
                  trackClick('cta_click', {
                    location: 'navbar',
                    cta_type: 'signup',
                  })
                }
                className="rounded-md bg-primary px-4 py-2 text-primary-foreground hover:opacity-90 transition"
              >
                {t('nav.signup')}
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="text-center">
            <h1 className="text-5xl font-bold tracking-tight text-foreground sm:text-6xl">
              {t('hero.title').split(', ')[0]},
              <span className="block text-accent">
                {t('hero.title').split(', ')[1]}
              </span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
              {t('hero.subtitle')}
            </p>
            <div className="mt-10 flex items-center justify-center gap-x-6">
              <Link
                href="/register"
                onClick={() =>
                  trackClick('cta_click', {
                    location: 'hero',
                    cta_type: 'get_started',
                  })
                }
                className="rounded-md bg-primary px-6 py-3 text-lg font-semibold text-primary-foreground hover:opacity-90 transition"
              >
                {t('hero.cta')}
              </Link>
            </div>
          </div>

          {/* Three-Column Demo */}
          <div className="mx-auto mt-16 max-w-7xl">
            <h2 className="text-center text-2xl font-bold mb-8 text-foreground">
              {t('demo.title')}
            </h2>
            <div className="grid gap-6 md:grid-cols-3">
              {getDemoExamples(locale).map((example: any) => (
                <DemoCard key={example.id} example={example} t={t} />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Trust & Compliance Section */}
      <section className="bg-gradient-to-b from-primary/5 to-background px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl text-center">
          <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl mb-4">
            {t('compliance.title')}
          </h2>
          <p className="mx-auto max-w-3xl text-lg text-muted-foreground mb-8">
            {t('compliance.subtitle')}
          </p>
          <div className="flex flex-wrap justify-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-secondary" />
              <span className="font-semibold">
                {t('compliance.badges.gdpr')}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-secondary" />
              <span className="font-semibold">
                {t('compliance.badges.aiAct')}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Database className="h-5 w-5 text-secondary" />
              <span className="font-semibold">
                {t('compliance.badges.servers')}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-secondary" />
              <span className="font-semibold">
                {t('compliance.badges.multilingual')}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="bg-muted/30 px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              {t('features.title')}
            </h2>
          </div>

          <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-lg border border-border bg-card p-6">
              <Zap className="h-10 w-10 text-secondary" />
              <h3 className="mt-4 text-xl font-semibold">
                {t('features.rag.title')}
              </h3>
              <p className="mt-2 text-muted-foreground">
                {t('features.rag.description')}
              </p>
            </div>

            <div className="rounded-lg border border-border bg-card p-6">
              <Shield className="h-10 w-10 text-primary" />
              <h3 className="mt-4 text-xl font-semibold">
                {t('features.gdpr.title')}
              </h3>
              <p className="mt-2 text-muted-foreground">
                {t('features.gdpr.description')}
              </p>
            </div>

            <div className="rounded-lg border border-border bg-card p-6">
              <Bot className="h-10 w-10 text-accent" />
              <h3 className="mt-4 text-xl font-semibold">
                {t('features.agents.title')}
              </h3>
              <p className="mt-2 text-muted-foreground">
                {t('features.agents.description')}
              </p>
            </div>

            <div className="rounded-lg border border-border bg-card p-6">
              <FileText className="h-10 w-10 text-secondary" />
              <h3 className="mt-4 text-xl font-semibold">
                {t('features.sources.title')}
              </h3>
              <p className="mt-2 text-muted-foreground">
                {t('features.sources.description')}
              </p>
            </div>

            <div className="rounded-lg border border-border bg-card p-6">
              <Database className="h-10 w-10 text-primary" />
              <h3 className="mt-4 text-xl font-semibold">
                {t('features.data.title')}
              </h3>
              <p className="mt-2 text-muted-foreground">
                {t('features.data.description')}
              </p>
            </div>

            <div className="rounded-lg border border-border bg-card p-6">
              <Globe className="h-10 w-10 text-accent" />
              <h3 className="mt-4 text-xl font-semibold">
                {t('features.multilingual.title')}
              </h3>
              <p className="mt-2 text-muted-foreground">
                {t('features.multilingual.description')}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* AI Agents Section */}
      <section id="agents" className="px-4 py-20 sm:px-6 lg:px-8 bg-background">
        <div className="mx-auto max-w-7xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl mb-4">
              {t('aiAgents.title')}
            </h2>
            <p className="mx-auto max-w-3xl text-lg text-muted-foreground">
              {t('aiAgents.subtitle')}
            </p>
          </div>

          <AIAgentsCatalog t={t} trackClick={trackClick} />

          {/* Superpowers Grid */}
          <div className="mt-16 grid gap-6 md:grid-cols-3">
            <div className="rounded-lg border border-accent/30 bg-accent/5 p-6 text-center">
              <Zap className="h-8 w-8 mx-auto mb-3 text-accent" />
              <h3 className="font-semibold mb-2">
                {t('aiAgents.superpowers.understanding.title')}
              </h3>
              <p className="text-sm text-muted-foreground">
                {t('aiAgents.superpowers.understanding.description')}
              </p>
            </div>
            <div className="rounded-lg border border-secondary/30 bg-secondary/5 p-6 text-center">
              <CheckCircle className="h-8 w-8 mx-auto mb-3 text-secondary" />
              <h3 className="font-semibold mb-2">
                {t('aiAgents.superpowers.cited.title')}
              </h3>
              <p className="text-sm text-muted-foreground">
                {t('aiAgents.superpowers.cited.description')}
              </p>
            </div>
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-6 text-center">
              <Bot className="h-8 w-8 mx-auto mb-3 text-primary" />
              <h3 className="font-semibold mb-2">
                {t('aiAgents.superpowers.expertise.title')}
              </h3>
              <p className="text-sm text-muted-foreground">
                {t('aiAgents.superpowers.expertise.description')}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Team Management Section - New Design */}
      <section className="px-4 py-20 sm:px-6 lg:px-8 bg-gradient-to-b from-muted/30 to-background">
        <div className="mx-auto max-w-7xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl mb-4">
              {messages?.teamManagement?.title || 'Built for Teams'}
            </h2>
            <p className="mx-auto max-w-3xl text-lg text-muted-foreground">
              {messages?.teamManagement?.subtitle ||
                'Collaborate seamlessly with powerful team management and shared knowledge bases.'}
            </p>
          </div>

          {/* Visual Flow Design */}
          <div className="space-y-12">
            {/* Row 1: Team Workspace */}
            <div className="flex flex-col lg:flex-row items-center gap-8 lg:gap-12">
              <div className="flex-1 order-2 lg:order-1">
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-primary/70 shadow-lg">
                    <Users className="h-6 w-6 text-white" />
                  </div>
                  <h3 className="text-2xl font-bold text-foreground">
                    {messages?.teamManagement?.teams?.title || 'Team Workspace'}
                  </h3>
                </div>
                <p className="text-lg text-muted-foreground mb-6">
                  {messages?.teamManagement?.teams?.description ||
                    'Create workspaces, invite members, assign roles, and collaborate on shared documents'}
                </p>
                <ul className="space-y-3">
                  <li className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                    <span className="text-muted-foreground">
                      {locale === 'fr'
                        ? 'Invitez des membres par email avec rôles personnalisés'
                        : locale === 'nl'
                          ? 'Nodig leden uit via email met aangepaste rollen'
                          : 'Invite members via email with custom roles'}
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                    <span className="text-muted-foreground">
                      {locale === 'fr'
                        ? "Admin, Éditeur, Lecteur - contrôlez chaque niveau d'accès"
                        : locale === 'nl'
                          ? 'Admin, Editor, Reader - beheer elk toegangsniveau'
                          : 'Admin, Editor, Reader - control every access level'}
                    </span>
                  </li>
                </ul>
              </div>
              <div className="flex-1 order-1 lg:order-2">
                <div className="rounded-2xl border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-background p-8 shadow-xl">
                  <div className="space-y-3">
                    {/* Mock team members */}
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-card border border-border">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center text-white font-semibold text-sm">
                        JD
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold">John Doe</p>
                        <p className="text-xs text-muted-foreground">Admin</p>
                      </div>
                      <Shield className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-card border border-border">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-secondary to-secondary/70 flex items-center justify-center text-white font-semibold text-sm">
                        AS
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold">Alice Smith</p>
                        <p className="text-xs text-muted-foreground">Editor</p>
                      </div>
                      <FileText className="h-4 w-4 text-secondary" />
                    </div>
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-card border border-border opacity-60">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-accent to-accent/70 flex items-center justify-center text-white font-semibold text-sm">
                        +3
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold">3 more members</p>
                        <p className="text-xs text-muted-foreground">Readers</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Row 2: Shared Knowledge Bases */}
            <div className="flex flex-col lg:flex-row items-center gap-8 lg:gap-12">
              <div className="flex-1 order-1">
                <div className="rounded-2xl border-2 border-secondary/20 bg-gradient-to-br from-secondary/5 to-background p-8 shadow-xl">
                  <div className="space-y-3">
                    {/* Mock RAG collections */}
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-card border border-border">
                      <Database className="h-8 w-8 text-secondary" />
                      <div className="flex-1">
                        <p className="text-sm font-semibold">Legal Documents</p>
                        <p className="text-xs text-muted-foreground">
                          1,234 documents • Team access
                        </p>
                      </div>
                      <Globe className="h-4 w-4 text-secondary" />
                    </div>
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-card border border-border">
                      <Database className="h-8 w-8 text-primary" />
                      <div className="flex-1">
                        <p className="text-sm font-semibold">HR Policies</p>
                        <p className="text-xs text-muted-foreground">
                          567 documents • Private
                        </p>
                      </div>
                      <Shield className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-card border border-border opacity-60">
                      <Database className="h-8 w-8 text-accent" />
                      <div className="flex-1">
                        <p className="text-sm font-semibold">
                          Tech Documentation
                        </p>
                        <p className="text-xs text-muted-foreground">
                          890 documents • Shared
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex-1 order-2">
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-secondary to-secondary/70 shadow-lg">
                    <Database className="h-6 w-6 text-white" />
                  </div>
                  <h3 className="text-2xl font-bold text-foreground">
                    {messages?.teamManagement?.rags?.title ||
                      'Shared Knowledge Bases'}
                  </h3>
                </div>
                <p className="text-lg text-muted-foreground mb-6">
                  {messages?.teamManagement?.rags?.description ||
                    'Build organization-wide RAG collections accessible to your entire team with permission controls'}
                </p>
                <ul className="space-y-3">
                  <li className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-secondary flex-shrink-0 mt-0.5" />
                    <span className="text-muted-foreground">
                      {locale === 'fr'
                        ? 'Collections publiques ou privées par équipe'
                        : locale === 'nl'
                          ? 'Publieke of privé collecties per team'
                          : 'Public or private collections per team'}
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-secondary flex-shrink-0 mt-0.5" />
                    <span className="text-muted-foreground">
                      {locale === 'fr'
                        ? 'Synchronisation automatique des documents'
                        : locale === 'nl'
                          ? 'Automatische synchronisatie van documenten'
                          : 'Automatic document synchronization'}
                    </span>
                  </li>
                </ul>
              </div>
            </div>

            {/* Row 3: Access Control */}
            <div className="flex flex-col lg:flex-row items-center gap-8 lg:gap-12">
              <div className="flex-1 order-2 lg:order-1">
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-accent to-accent/70 shadow-lg">
                    <Shield className="h-6 w-6 text-white" />
                  </div>
                  <h3 className="text-2xl font-bold text-foreground">
                    {messages?.teamManagement?.access?.title ||
                      'Granular Access Control'}
                  </h3>
                </div>
                <p className="text-lg text-muted-foreground mb-6">
                  {messages?.teamManagement?.access?.description ||
                    'Define who can view, edit, or manage each knowledge base with role-based permissions'}
                </p>
                <ul className="space-y-3">
                  <li className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-accent flex-shrink-0 mt-0.5" />
                    <span className="text-muted-foreground">
                      {locale === 'fr'
                        ? 'Permissions par base de connaissances'
                        : locale === 'nl'
                          ? 'Rechten per kennisbank'
                          : 'Per-knowledge-base permissions'}
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-accent flex-shrink-0 mt-0.5" />
                    <span className="text-muted-foreground">
                      {locale === 'fr'
                        ? 'Audit trail de toutes les actions'
                        : locale === 'nl'
                          ? 'Audit trail van alle acties'
                          : 'Audit trail of all actions'}
                    </span>
                  </li>
                </ul>
              </div>
              <div className="flex-1 order-1 lg:order-2">
                <div className="rounded-2xl border-2 border-accent/20 bg-gradient-to-br from-accent/5 to-background p-8 shadow-xl">
                  <div className="space-y-4">
                    {/* Permission matrix */}
                    <div className="grid grid-cols-3 gap-2 text-xs font-semibold text-center mb-4">
                      <div></div>
                      <div className="text-muted-foreground">View</div>
                      <div className="text-muted-foreground">Edit</div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 items-center p-2 rounded-lg bg-card border border-border">
                      <span className="text-sm font-medium">Admin</span>
                      <CheckCircle className="h-4 w-4 text-accent mx-auto" />
                      <CheckCircle className="h-4 w-4 text-accent mx-auto" />
                    </div>
                    <div className="grid grid-cols-3 gap-2 items-center p-2 rounded-lg bg-card border border-border">
                      <span className="text-sm font-medium">Editor</span>
                      <CheckCircle className="h-4 w-4 text-accent mx-auto" />
                      <CheckCircle className="h-4 w-4 text-accent mx-auto" />
                    </div>
                    <div className="grid grid-cols-3 gap-2 items-center p-2 rounded-lg bg-card border border-border opacity-60">
                      <span className="text-sm font-medium">Reader</span>
                      <CheckCircle className="h-4 w-4 text-accent mx-auto" />
                      <div className="w-4 h-4 rounded-full border-2 border-muted-foreground/30 mx-auto" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Mobile App Banner - Compact */}
      <section className="px-4 py-12 sm:px-6 lg:px-8 bg-gradient-to-r from-accent/10 via-secondary/5 to-primary/10">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 bg-card/50 backdrop-blur-sm border border-border rounded-2xl p-8">
            {/* Left - Content */}
            <div className="flex-1 text-center md:text-left">
              <div className="inline-flex items-center gap-2 bg-accent/20 text-accent px-3 py-1 rounded-full text-xs font-semibold mb-3">
                <Smartphone className="h-3 w-3" />
                New
              </div>
              <h3 className="text-2xl font-bold mb-2">
                {messages?.mobileApp?.title || 'Get Answers Even Faster'}
              </h3>
              <p className="text-muted-foreground mb-4 max-w-xl">
                {messages?.mobileApp?.subtitle ||
                  'Download our mobile app for instant access to your AI agents anywhere, anytime.'}
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center md:justify-start items-center">
                <button
                  onClick={() =>
                    trackClick('mobile_app_click', {
                      location: 'mobile_banner',
                    })
                  }
                  className="inline-flex items-center gap-2 rounded-lg bg-foreground px-6 py-2.5 text-sm font-semibold text-background hover:opacity-90 transition-opacity"
                >
                  <Smartphone className="h-4 w-4" />
                  {messages?.mobileApp?.cta || 'Download App'}
                </button>
                <span className="text-xs text-muted-foreground">
                  {messages?.mobileApp?.platforms ||
                    'Available on iOS and Android'}
                </span>
              </div>
            </div>

            {/* Right - Mini Phone Preview */}
            <div className="flex-shrink-0">
              <div className="relative w-[220px] h-[440px] rounded-[2.5rem] border-[6px] border-foreground/20 bg-background shadow-2xl overflow-hidden">
                <div className="p-3 h-full flex flex-col bg-gradient-to-b from-background via-primary/5 to-accent/5">
                  {/* App Header */}
                  <div className="flex items-center justify-between mb-3 pb-2 border-b border-border/30">
                    <div className="flex items-center gap-2">
                      <Image
                        src="/docuralis.png"
                        alt="App"
                        width={28}
                        height={28}
                      />
                      <span className="text-[11px] font-bold">Docuralis</span>
                    </div>
                    <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
                  </div>

                  {/* Chat History Sidebar Hint */}
                  <div className="mb-2 flex items-center justify-between bg-muted/30 rounded-lg px-2 py-1.5 border border-border/40">
                    <div className="flex items-center gap-1.5">
                      <Database className="h-3 w-3 text-muted-foreground" />
                      <span className="text-[8px] text-muted-foreground font-medium">
                        {locale === 'fr'
                          ? '24 conversations'
                          : locale === 'nl'
                            ? '24 gesprekken'
                            : '24 chats'}
                      </span>
                    </div>
                    <span className="text-[7px] text-accent">
                      {locale === 'fr'
                        ? 'Voir tout'
                        : locale === 'nl'
                          ? 'Bekijk alles'
                          : 'View all'}
                    </span>
                  </div>

                  {/* Chat Messages */}
                  <div className="space-y-2 flex-1 overflow-hidden">
                    {/* User Question */}
                    <div className="bg-primary/10 border border-primary/30 rounded-lg p-2">
                      <p className="text-[9px] font-semibold text-primary mb-0.5">
                        {locale === 'fr'
                          ? 'Vous'
                          : locale === 'nl'
                            ? 'Jij'
                            : 'You'}
                      </p>
                      <p className="text-[10px] text-foreground leading-snug">
                        {locale === 'fr'
                          ? 'Quels sont les termes de paiement?'
                          : locale === 'nl'
                            ? 'Wat zijn de betalingsvoorwaarden?'
                            : 'What are the payment terms?'}
                      </p>
                    </div>

                    {/* AI Answer with Sources */}
                    <div className="bg-accent/10 border border-accent/30 rounded-lg p-2">
                      <div className="flex items-center gap-1 mb-1">
                        <Bot className="h-3 w-3 text-accent" />
                        <p className="text-[9px] font-semibold text-accent">
                          Legal Expert
                        </p>
                      </div>
                      <p className="text-[10px] text-foreground/90 mb-2 leading-snug">
                        {locale === 'fr'
                          ? 'Selon la section 4.2, le paiement doit être effectué sous 30 jours.'
                          : locale === 'nl'
                            ? 'Volgens sectie 4.2 moet betaling binnen 30 dagen plaatsvinden.'
                            : 'According to section 4.2, payment is due within 30 days.'}
                      </p>
                      {/* Sources */}
                      <div className="flex items-center gap-1 pt-1.5 border-t border-accent/20">
                        <FileText className="h-2.5 w-2.5 text-accent/70" />
                        <span className="text-[8px] text-accent/70 font-medium">
                          contract.pdf • p.4
                        </span>
                      </div>
                    </div>

                    {/* Suggestion Chips */}
                    <div className="flex gap-1 flex-wrap pt-1">
                      <div className="bg-secondary/10 border border-secondary/30 rounded-full px-2 py-1">
                        <span className="text-[8px] text-secondary">
                          {locale === 'fr'
                            ? 'RH'
                            : locale === 'nl'
                              ? 'HR'
                              : 'HR'}
                        </span>
                      </div>
                      <div className="bg-primary/10 border border-primary/30 rounded-full px-2 py-1">
                        <span className="text-[8px] text-primary">
                          {locale === 'fr'
                            ? 'IT'
                            : locale === 'nl'
                              ? 'IT'
                              : 'IT'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Input Bar */}
                  <div className="mt-auto bg-card/80 backdrop-blur-sm border border-border rounded-full px-3 py-2 flex items-center gap-2 shadow-sm">
                    <Search className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-[9px] text-muted-foreground">
                      {locale === 'fr'
                        ? 'Posez votre question...'
                        : locale === 'nl'
                          ? 'Stel uw vraag...'
                          : 'Ask your question...'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="px-4 py-20 sm:px-6 lg:px-8 bg-muted/30">
        <div className="mx-auto max-w-7xl">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              {t('pricing.title')}
            </h2>
          </div>

          <div className="mt-16 grid gap-8 lg:grid-cols-3">
            {/* Free Plan */}
            <div className="rounded-lg border border-border bg-card p-8">
              <h3 className="text-2xl font-semibold">
                {t('pricing.free.name')}
              </h3>
              <p className="mt-2 text-muted-foreground">
                {t('pricing.free.description')}
              </p>
              <p className="mt-4 text-4xl font-bold">
                {t('pricing.free.price')}
              </p>
              <ul className="mt-6 space-y-3">
                {(messages.pricing.free.features as string[]).map(
                  (feature: string) => (
                    <li key={feature} className="flex items-start">
                      <span className="mr-2 text-secondary">✓</span>
                      <span className="text-muted-foreground">{feature}</span>
                    </li>
                  )
                )}
              </ul>
              <Link
                href="/register"
                onClick={() =>
                  trackClick('pricing_plan_click', {
                    plan: 'free',
                    location: 'pricing_section',
                  })
                }
                className="mt-8 block w-full rounded-md border border-primary bg-background px-4 py-2 text-center font-semibold text-primary hover:bg-primary hover:text-primary-foreground transition"
              >
                {t('pricing.free.cta')}
              </Link>
            </div>

            {/* Pro Plan */}
            <div className="rounded-lg border-2 border-accent bg-card p-8 shadow-lg">
              <div className="inline-block rounded-full bg-accent px-3 py-1 text-sm font-semibold text-accent-foreground">
                {t('pricing.pro.badge')}
              </div>
              <h3 className="mt-4 text-2xl font-semibold">
                {t('pricing.pro.name')}
              </h3>
              <p className="mt-2 text-muted-foreground">
                {t('pricing.pro.description')}
              </p>
              <p className="mt-4 text-4xl font-bold">
                {t('pricing.pro.price')}
                <span className="text-lg font-normal text-muted-foreground">
                  {t('pricing.pro.period')}
                </span>
              </p>
              <ul className="mt-6 space-y-3">
                {(messages.pricing.pro.features as string[]).map(
                  (feature: string) => (
                    <li key={feature} className="flex items-start">
                      <span className="mr-2 text-secondary">✓</span>
                      <span className="text-muted-foreground">{feature}</span>
                    </li>
                  )
                )}
              </ul>
              <Link
                href="/register"
                onClick={() =>
                  trackClick('pricing_plan_click', {
                    plan: 'pro',
                    location: 'pricing_section',
                  })
                }
                className="mt-8 block w-full rounded-md bg-accent px-4 py-2 text-center font-semibold text-accent-foreground hover:opacity-90 transition"
              >
                {t('pricing.pro.cta')}
              </Link>
            </div>

            {/* Enterprise Plan */}
            <div className="rounded-lg border border-border bg-card p-8">
              <h3 className="text-2xl font-semibold">
                {t('pricing.enterprise.name')}
              </h3>
              <p className="mt-2 text-muted-foreground">
                {t('pricing.enterprise.description')}
              </p>
              <p className="mt-4 text-4xl font-bold">
                {t('pricing.enterprise.price')}
              </p>
              <ul className="mt-6 space-y-3">
                {(messages.pricing.enterprise.features as string[]).map(
                  (feature: string) => (
                    <li key={feature} className="flex items-start">
                      <span className="mr-2 text-secondary">✓</span>
                      <span className="text-muted-foreground">{feature}</span>
                    </li>
                  )
                )}
              </ul>
              <a
                href="mailto:contact@docuralis.com"
                onClick={() =>
                  trackClick('pricing_plan_click', {
                    plan: 'enterprise',
                    location: 'pricing_section',
                  })
                }
                className="mt-8 block w-full rounded-md border border-primary bg-background px-4 py-2 text-center font-semibold text-primary hover:bg-primary hover:text-primary-foreground transition"
              >
                {t('pricing.enterprise.cta')}
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-primary px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-primary-foreground sm:text-4xl">
            {t('cta.title')}
          </h2>
          <div className="mt-10">
            <Link
              href="/register"
              onClick={() =>
                trackClick('cta_click', {
                  location: 'final_cta',
                  cta_type: 'get_started',
                })
              }
              className="rounded-md bg-secondary px-8 py-4 text-lg font-semibold text-secondary-foreground hover:opacity-90 transition inline-block"
            >
              {t('cta.button')}
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-card/50 px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="text-center text-muted-foreground">
            <p>{t('footer.copyright')}</p>
            <div className="mt-4 flex justify-center gap-6">
              <a href="#" className="hover:text-foreground transition">
                {t('footer.privacy')}
              </a>
              <a href="#" className="hover:text-foreground transition">
                {t('footer.terms')}
              </a>
              <a href="#" className="hover:text-foreground transition">
                {t('footer.contact')}
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
