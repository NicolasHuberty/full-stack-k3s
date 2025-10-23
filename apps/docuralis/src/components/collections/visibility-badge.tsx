'use client'

import { HelpCircle, Lock, Users, Globe } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

type Visibility = 'PRIVATE' | 'ORGANIZATION' | 'PUBLIC'

interface VisibilityBadgeProps {
  visibility: Visibility
  locale?: 'fr' | 'en'
  showTooltip?: boolean
}

const visibilityConfig = {
  PRIVATE: {
    fr: {
      label: 'Privé',
      description:
        'Accessible uniquement par vous et les personnes que vous invitez',
      icon: Lock,
      color: 'text-gray-600 bg-gray-100',
    },
    en: {
      label: 'Private',
      description: 'Only accessible by you and people you invite',
      icon: Lock,
      color: 'text-gray-600 bg-gray-100',
    },
  },
  ORGANIZATION: {
    fr: {
      label: 'Organisation',
      description: 'Accessible par tous les membres de votre organisation',
      icon: Users,
      color: 'text-blue-600 bg-blue-100',
    },
    en: {
      label: 'Organization',
      description: 'Accessible by all members of your organization',
      icon: Users,
      color: 'text-blue-600 bg-blue-100',
    },
  },
  PUBLIC: {
    fr: {
      label: 'Public',
      description: 'Accessible par tout le monde avec le lien',
      icon: Globe,
      color: 'text-green-600 bg-green-100',
    },
    en: {
      label: 'Public',
      description: 'Accessible by anyone with the link',
      icon: Globe,
      color: 'text-green-600 bg-green-100',
    },
  },
}

export function VisibilityBadge({
  visibility,
  locale = 'fr',
  showTooltip = true,
}: VisibilityBadgeProps) {
  const config = visibilityConfig[visibility][locale]
  const Icon = config.icon

  const badge = (
    <span
      className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium ${config.color}`}
    >
      <Icon className="h-3.5 w-3.5" />
      {config.label}
      {showTooltip && <HelpCircle className="h-3 w-3 opacity-70" />}
    </span>
  )

  if (!showTooltip) {
    return badge
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent>
          <p className="max-w-xs">{config.description}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
