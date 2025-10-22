'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/dashboard/layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Loader2, Globe, CreditCard, Check } from 'lucide-react'

type PlanType = 'FREE' | 'STARTER' | 'PRO' | 'ENTERPRISE'

// Only include languages with translation files
const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'fr', name: 'Français' },
]

const PLANS = [
  {
    type: 'FREE' as PlanType,
    features: ['5GB Storage', 'Basic chat features', 'Up to 3 collections'],
  },
  {
    type: 'STARTER' as PlanType,
    features: ['50GB Storage', 'Advanced chat features', 'Unlimited collections', 'Email support'],
  },
  {
    type: 'PRO' as PlanType,
    features: ['250GB Storage', 'Priority support', 'Team collaboration', 'Advanced analytics'],
  },
  {
    type: 'ENTERPRISE' as PlanType,
    features: ['1TB Storage', 'Dedicated support', 'Custom integrations', 'SLA guarantee'],
  },
]

export default function SettingsPage() {
  const t = useTranslations('settings')
  const router = useRouter()
  const { data: session, update } = useSession()
  const [language, setLanguage] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [planLoading, setPlanLoading] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState<PlanType | null>(null)
  const [showPlanDialog, setShowPlanDialog] = useState(false)
  const [planMessage, setPlanMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    // Fetch current user language
    const fetchUserLanguage = async () => {
      try {
        const res = await fetch('/api/user/profile')
        if (res.ok) {
          const data = await res.json()
          console.log('User profile data:', data)
          if (data.language) {
            console.log('Setting language to:', data.language)
            setLanguage(data.language)
          } else {
            console.log('No language in profile, defaulting to en')
            setLanguage('en')
          }
        }
      } catch (error) {
        console.error('Failed to fetch user language:', error)
        setLanguage('en')
      }
    }

    fetchUserLanguage()
  }, [])

  const handleSaveLanguage = async () => {
    try {
      setLoading(true)
      setSaved(false)

      const res = await fetch('/api/user/language', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language }),
      })

      if (res.ok) {
        setSaved(true)
        // Update session to trigger re-render
        await update()
        // Reload the page to apply translations
        setTimeout(() => {
          router.refresh()
          window.location.reload()
        }, 1000)
      } else {
        alert('Failed to update language')
      }
    } catch (error) {
      console.error('Failed to update language:', error)
      alert('Failed to update language')
    } finally {
      setLoading(false)
    }
  }

  const handlePlanChange = (plan: PlanType) => {
    setSelectedPlan(plan)
    setShowPlanDialog(true)
  }

  const confirmPlanChange = async () => {
    if (!selectedPlan) return

    try {
      setPlanLoading(true)
      setPlanMessage(null)

      const res = await fetch('/api/user/plan', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planType: selectedPlan }),
      })

      if (res.ok) {
        setPlanMessage({ type: 'success', text: t('plan.changeSuccess') })
        setShowPlanDialog(false)
        await update()
        setTimeout(() => {
          router.refresh()
        }, 1000)
      } else {
        const error = await res.json()
        setPlanMessage({ type: 'error', text: error.error || t('plan.changeError') })
      }
    } catch (error) {
      console.error('Failed to change plan:', error)
      setPlanMessage({ type: 'error', text: t('plan.changeError') })
    } finally {
      setPlanLoading(false)
    }
  }

  return (
    <DashboardLayout>
      <div className="container mx-auto p-6 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6">{t('title')}</h1>

      <div className="space-y-6">
        {/* Language Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              {t('language.title')}
            </CardTitle>
            <CardDescription>
              {t('language.description')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="language">{t('language.label')}</Label>
              <Select
                value={language || undefined}
                onValueChange={setLanguage}
              >
                <SelectTrigger id="language" className="w-full md:w-[300px]">
                  <SelectValue placeholder={t('language.select')}>
                    {language && LANGUAGES.find(lang => lang.code === language)?.name}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {LANGUAGES.map((lang) => (
                    <SelectItem key={lang.code} value={lang.code}>
                      {lang.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-3">
              <Button onClick={handleSaveLanguage} disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('language.saving')}
                  </>
                ) : (
                  t('language.save')
                )}
              </Button>
              {saved && (
                <span className="text-sm text-green-600">
                  ✓ {t('language.saved')}
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Account Settings */}
        <Card>
          <CardHeader>
            <CardTitle>{t('account.title')}</CardTitle>
            <CardDescription>{t('account.description')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label className="text-sm text-gray-500">{t('account.name')}</Label>
              <p className="font-medium">{session?.user?.name || t('account.notSet')}</p>
            </div>
            <div>
              <Label className="text-sm text-gray-500">{t('account.email')}</Label>
              <p className="font-medium">{session?.user?.email}</p>
            </div>
          </CardContent>
        </Card>

        {/* Plan Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              {t('plan.title')}
            </CardTitle>
            <CardDescription>{t('plan.description')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {planMessage && (
              <div className={`p-4 rounded-lg ${planMessage.type === 'success' ? 'bg-green-500/10 text-green-600' : 'bg-red-500/10 text-red-600'}`}>
                {planMessage.text}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {PLANS.map((plan) => {
                const currentPlan = session?.user?.planType || 'FREE'
                const isCurrentPlan = currentPlan === plan.type

                return (
                  <div
                    key={plan.type}
                    className={`relative rounded-lg border-2 p-6 transition-all ${
                      isCurrentPlan
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    {isCurrentPlan && (
                      <div className="absolute top-4 right-4">
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-primary text-primary-foreground">
                          <Check className="h-3 w-3" />
                          {t('plan.currentPlan')}
                        </span>
                      </div>
                    )}

                    <div className="space-y-4">
                      <div>
                        <h3 className="text-xl font-bold">{t(`plan.${plan.type.toLowerCase()}`)}</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          {t(`plan.${plan.type.toLowerCase()}Desc`)}
                        </p>
                        <p className="text-2xl font-bold mt-3">
                          {t(`plan.${plan.type.toLowerCase()}Price`)}
                        </p>
                      </div>

                      <ul className="space-y-2">
                        {plan.features.map((feature, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-sm">
                            <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                            <span>{feature}</span>
                          </li>
                        ))}
                      </ul>

                      <Button
                        onClick={() => handlePlanChange(plan.type)}
                        disabled={isCurrentPlan || planLoading}
                        className="w-full"
                        variant={isCurrentPlan ? 'outline' : 'default'}
                      >
                        {isCurrentPlan
                          ? t('plan.currentPlan')
                          : t('plan.changePlan')}
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Plan Change Confirmation Dialog */}
      <AlertDialog open={showPlanDialog} onOpenChange={setShowPlanDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('plan.confirmChange')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('plan.confirmChangeDesc')} {selectedPlan && t(`plan.${selectedPlan.toLowerCase()}`)}?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={planLoading}>
              {t('plan.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction onClick={confirmPlanChange} disabled={planLoading}>
              {planLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('plan.changing')}
                </>
              ) : (
                t('plan.confirm')
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </div>
    </DashboardLayout>
  )
}
