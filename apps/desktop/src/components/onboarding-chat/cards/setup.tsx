/**
 * The three setup picks — accent, connectors, layout.
 *
 * Picks apply live. The shared catalog keeps cards and previews in agreement
 * without asking the model to enumerate the options.
 */

import { useStore } from '@nanostores/react'
import { useEffect, useState } from 'react'

import { useSessionView } from '@/app/chat/session-view'
import { resolveSessionOwner } from '@/app/session/hooks/use-session-actions/utils'
import { $chatLayoutPicked, assembleChatOnboarding } from '@/components/onboarding-chat/assembly'
import { CardFrame, type CardProps, useCardCommit } from '@/components/onboarding-chat/cards/frame'
import { Chip } from '@/components/onboarding-chat/chip'
import {
  accentsFor,
  AccentSwatch,
  CONNECTORS,
  LayoutPreviewCard,
  LAYOUTS,
  NOUS_ACCENT
} from '@/components/onboarding-chat/options'
import type { LayoutNode } from '@/components/pane-shell/tree/model'
import { ConnectorLogo } from '@/components/ui/connector-logo'
import { registry } from '@/contrib/registry'
import { useI18n } from '@/i18n'
import type { ConnectorRow } from '@/lib/connector-tools'
import { requestGatewayForAgent } from '@/store/gateway'
import { $onboardingAnswers, setOnboardingAnswers } from '@/store/onboarding-answers'
import { $activeGatewayProfile } from '@/store/profile'
import { assertSessionOwnerResolved } from '@/store/session-owner-resolution'
import { isSessionOwnerRoute } from '@/store/session-request-router'
import { useTheme } from '@/themes'
import { setAccentOverride } from '@/themes/accent-override'

export function ConnectorsCard({ locked }: CardProps) {
  const { t } = useI18n()
  const view = useSessionView()
  const storedId = useStore(view.$storedId)
  const runtimeId = useStore(view.$runtimeId)
  const answers = useStore($onboardingAnswers)
  const { commit, done } = useCardCommit()
  const [catalog, setCatalog] = useState<'loading' | 'unavailable' | Set<string>>('unavailable')

  useEffect(() => {
    if (!storedId || !runtimeId) {
      setCatalog('unavailable')

      return
    }

    setCatalog('loading')
    let cancelled = false
    const ambientProfile = $activeGatewayProfile.get()
    void resolveSessionOwner(storedId)
      .then(scope => {
        assertSessionOwnerResolved(scope, { method: 'connectors.list', sessionId: storedId })
        const connectionId = isSessionOwnerRoute(scope) ? scope.connectionId : null
        const profile = isSessionOwnerRoute(scope) ? scope.profile : scope || ambientProfile

        return requestGatewayForAgent<{ available: boolean; connectors: ConnectorRow[] }>(
          connectionId,
          profile,
          'connectors.list',
          { session_id: runtimeId },
          15000
        )
      })
      .then(result => {
        const enabled = new Set(result.connectors.filter(row => row.enabled).map(row => row.connector))

        if (!cancelled) {
          setCatalog(
            result.available && CONNECTORS.some(connector => enabled.has(connector.id)) ? enabled : 'unavailable'
          )
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCatalog('unavailable')
        }
      })

    return () => {
      cancelled = true
    }
  }, [storedId, runtimeId])

  const connectors = CONNECTORS.filter(
    connector => catalog === 'loading' || (catalog instanceof Set && catalog.has(connector.id))
  )

  const picked = connectors.filter(connector => answers.connectors.includes(connector.id))

  const toggle = (id: string) =>
    setOnboardingAnswers({
      connectors: answers.connectors.includes(id)
        ? answers.connectors.filter(item => item !== id)
        : [...answers.connectors, id]
    })

  return (
    <CardFrame
      continueLabel={
        catalog === 'unavailable' ? 'Continue' : picked.length > 0 ? `Continue with ${picked.length}` : 'None of these'
      }
      disabled={catalog === 'loading'}
      done={done}
      locked={locked}
      onContinue={() => {
        if (
          commit(
            catalog === 'unavailable'
              ? 'apps I use: none for now (connections unreachable)'
              : `apps I use, not connected yet: ${picked.length > 0 ? picked.map(c => c.name).join(', ') : 'none for now'}`
          )
        ) {
          setOnboardingAnswers({ connectors: picked.map(connector => connector.id) })
        }
      }}
    >
      {catalog === 'loading' ? <p className="text-xs text-muted-foreground">{t.connectors.checkingCatalog}</p> : null}
      {catalog === 'unavailable' ? (
        <p className="text-xs text-muted-foreground">{t.connectors.catalogUnreachable}</p>
      ) : null}
      <fieldset className="grid grid-cols-3 gap-2" disabled={catalog === 'loading' || done}>
        {connectors.map(connector => (
          <Chip
            icon={
              <ConnectorLogo
                className="size-7 rounded-full text-sm"
                connector={{ homepage: connector.homepage, name: connector.id, title: connector.name }}
              />
            }
            key={connector.id}
            label={connector.name}
            on={answers.connectors.includes(connector.id)}
            onToggle={() => toggle(connector.id)}
          />
        ))}
      </fieldset>
      {/* Picking is a preference, not an authorization: nothing is signed into
          here. Saying so keeps the connect step at the start of the first task
          from reading as a second ask for the same thing. */}
      <p className="text-xs text-muted-foreground">
        Nothing connects yet. Your first task starts by connecting these, and Hermes asks before reading anything.
      </p>
    </CardFrame>
  )
}

export function LookCard({ locked }: CardProps) {
  const answers = useStore($onboardingAnswers)
  const { renderedMode } = useTheme()
  const { commit, done } = useCardCommit()
  const accents = accentsFor(renderedMode === 'dark')
  const accent = answers.accent ?? NOUS_ACCENT
  const picked = accents.find(swatch => swatch.hex === accent.toLowerCase())

  const pickAccent = (hex: string) => {
    const seed = hex === NOUS_ACCENT ? null : hex

    setOnboardingAnswers({ accent: seed })
    setAccentOverride(seed)
  }

  return (
    <CardFrame done={done} locked={locked} onContinue={() => commit(`accent color: ${picked?.name ?? accent}`)}>
      <div className="flex flex-wrap gap-2.5">
        {accents.map(swatch => (
          <AccentSwatch
            active={accent.toLowerCase() === swatch.hex}
            hex={swatch.hex}
            key={swatch.name}
            name={swatch.name}
            onPick={() => pickAccent(swatch.hex)}
          />
        ))}
      </div>
    </CardFrame>
  )
}

export function LayoutCard({ locked }: CardProps) {
  const answers = useStore($onboardingAnswers)
  const { commit, done } = useCardCommit()
  // The stored answer defaults to 'basic', but the CHOICE is the point of this
  // step — nothing renders selected (and Continue stays off) until they click.
  // Store-backed: the pick's own layout apply remounts this card (the pane
  // tree is replaced), so local state would drop the highlight instantly.
  const picked = useStore($chatLayoutPicked)

  const pickLayout = (id: string) => {
    $chatLayoutPicked.set(true)
    setOnboardingAnswers({ layout: id })

    // Live, behind the chat — the panes rearrange as the option is clicked.
    const preset = registry.getArea('layouts').find(contribution => contribution.id === id)

    if (!preset?.data) {
      return
    }

    // Every pick goes through assembly, including re-picks. The first grows
    // the window and places the panes, keeping the chat (and the cursor over
    // this card) pixel-fixed; later ones re-arrange in place. Swapping just the
    // preset tree on a re-pick left the previous layout's dismissals and dock
    // records in force, and the two layouts came up mixed together.
    // SAFETY: Layout presets declare data: LayoutNode (pane-shell/tree/presets.ts).
    assembleChatOnboarding(preset.id, preset.data as LayoutNode)
  }

  return (
    <CardFrame
      disabled={!picked}
      done={done}
      locked={locked}
      onContinue={() => {
        const choice = LAYOUTS.find(layout => layout.id === answers.layout)

        commit(`layout: ${choice?.name ?? answers.layout}`)
      }}
    >
      <div className="grid grid-cols-2 gap-3">
        {LAYOUTS.map(layout => (
          <LayoutPreviewCard
            active={picked && answers.layout === layout.id}
            key={layout.id}
            name={layout.name}
            onSelect={() => pickLayout(layout.id)}
            tree={layout.tree}
          />
        ))}
      </div>
    </CardFrame>
  )
}
