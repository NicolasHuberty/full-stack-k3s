'use client'

import { HelpCircle } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

type Permission = 'VIEWER' | 'EDITOR' | 'ADMIN'

interface PermissionBadgeProps {
  permission: Permission
  locale?: 'fr' | 'en'
  showTooltip?: boolean
}

const permissionConfig = {
  VIEWER: {
    fr: {
      label: 'Lecteur',
      description:
        'Peut consulter les documents et discuter avec la collection',
    },
    en: {
      label: 'Viewer',
      description: 'Can view documents and chat with the collection',
    },
  },
  EDITOR: {
    fr: {
      label: 'Éditeur',
      description: 'Peut ajouter, modifier et supprimer des documents',
    },
    en: {
      label: 'Editor',
      description: 'Can add, edit, and delete documents',
    },
  },
  ADMIN: {
    fr: {
      label: 'Administrateur',
      description:
        'Contrôle total incluant la gestion des permissions et la suppression de la collection',
    },
    en: {
      label: 'Administrator',
      description:
        'Full control including managing permissions and deleting the collection',
    },
  },
}

export function PermissionBadge({
  permission,
  locale = 'fr',
  showTooltip = true,
}: PermissionBadgeProps) {
  const config = permissionConfig[permission][locale]

  const badge = (
    <span className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-muted rounded">
      {config.label}
      {showTooltip && <HelpCircle className="h-3 w-3 text-muted-foreground" />}
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
