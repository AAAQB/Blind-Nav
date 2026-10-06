import { areaText, useI18n } from '../../lib/i18n'
import type { AreaMeta } from '../../lib/types'
import { Icon } from '../ui/Icon'
import { Pill } from '../ui/Primitives'

interface Props {
  areas: AreaMeta[]
  activeArea: string | null
  onJump: (area: AreaMeta) => void
  loadedArea: string | null
}

/**
 * Region shortcuts. The backend loads whichever graph the coordinates need, so
 * these buttons mostly exist to move the camera and seed sensible demo points.
 */
export function RegionPicker({ areas, activeArea, onJump, loadedArea }: Props) {
  const { t, lang } = useI18n()

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-1.5">
        {areas.map((area) => {
          const active = activeArea === area.id
          return (
            <Pill
              key={area.id}
              active={active}
              icon="globe"
              onClick={() => onJump(area)}
              className="justify-start"
            >
              {areaText(lang, area.id, area.name)}
            </Pill>
          )
        })}
      </div>
      <p className="flex items-center gap-1.5 text-[10.5px] text-subtle">
        <Icon name="info" size={11} />
        {loadedArea
          ? t('region.loaded', { area: areaText(lang, loadedArea, loadedArea) })
          : t('region.anywhere')}
      </p>
    </div>
  )
}
