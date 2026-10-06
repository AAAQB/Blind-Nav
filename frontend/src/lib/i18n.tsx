import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Direction, RouteFactors, RoutePlan } from './types'

export type Lang = 'zh' | 'en'

export const LANGS: Lang[] = ['zh', 'en']

export const LANG_LABEL: Record<Lang, string> = { zh: '中文', en: 'EN' }

/* ══════════════════════════════════════════════════════════════════
   UI strings
   ══════════════════════════════════════════════════════════════════ */

const DICT = {
  'app.tagline': { zh: '面向视障人士的无障碍步行导航', en: 'Accessibility-aware pedestrian routing' },
  'app.title': { zh: 'BlindNav 无障碍导航', en: 'BlindNav — Accessible Navigation' },
  'app.docTitle': { zh: 'BlindNav —— 无障碍步行导航', en: 'BlindNav — Accessible Navigation' },
  'lang.switch': { zh: '切换语言', en: 'Switch language' },

  'section.whereTo': { zh: '去哪里', en: 'Where to?' },
  'section.startEnd': { zh: '起点与终点', en: 'Start & destination' },
  'section.region': { zh: '区域', en: 'Region' },
  'section.alternatives': { zh: '出行方案', en: 'Alternatives' },
  'section.departure': { zh: '出发时间', en: 'Departure time' },
  'section.options': { zh: '分析选项', en: 'Analysis options' },

  'search.placeholder': { zh: '搜索地标、街道或城市…', en: 'Search a landmark, street or city…' },
  'search.useMyLocation': { zh: '使用我的当前位置', en: 'Use my current location' },
  'search.locating': { zh: '定位中…', en: 'Locating…' },
  'search.clear': { zh: '清空搜索', en: 'Clear search' },
  'search.denied': { zh: '定位权限被拒绝', en: 'Location permission denied' },
  'search.unavailable': { zh: '当前浏览器不支持定位', en: 'Geolocation is not available in this browser' },

  'input.start': { zh: '起点', en: 'Start' },
  'input.end': { zh: '终点', en: 'Destination' },
  'input.startPlaceholder': { zh: '起点纬度, 经度', en: 'Start lat, lon' },
  'input.endPlaceholder': { zh: '终点纬度, 经度', en: 'End lat, lon' },
  'input.startAria': { zh: '起点坐标', en: 'Start coordinates' },
  'input.endAria': { zh: '终点坐标', en: 'Destination coordinates' },
  'input.resolving': { zh: '正在解析地址…', en: 'Resolving address…' },
  'input.tapMap': { zh: '点击地图或在上方搜索', en: 'Tap the map or search above' },
  'input.whereHeading': { zh: '你想去哪里？', en: 'Where are you heading?' },
  'input.pickStart': { zh: '在地图上选起点', en: 'Pick start on the map' },
  'input.pickEnd': { zh: '在地图上选终点', en: 'Pick destination on the map' },
  'input.cancelPick': { zh: '取消选点', en: 'Cancel picking' },
  'input.clear': { zh: '清除', en: 'Clear' },
  'input.swap': { zh: '交换起点与终点', en: 'Swap start and destination' },
  'input.droppedPin': { zh: '地图上的点', en: 'Dropped pin' },

  'region.hint': { zh: '一键把镜头跳到示例城市，也可以直接输入任意经纬度。', en: 'Jump the camera to a demo city, or just type any coordinates.' },
  'region.loaded': { zh: '已加载路网：{area}', en: 'Loaded network: {area}' },
  'region.anywhere': { zh: '任意坐标均可 —— 会按需下载对应的 OpenStreetMap 数据。', en: 'Any coordinates work — the matching OpenStreetMap extract is fetched on demand.' },

  'profiles.hint': { zh: '每个方案优化不同的目标，因此它们之间的取舍是真实的。', en: 'Each profile optimises a different objective, so their trade-offs are real.' },
  'profiles.max': { zh: '一次最多同时计算 {n} 个方案，并在地图上对比。', en: 'Up to {n} alternatives are computed in one request and compared on the map.' },
  'profiles.limitTooltip': { zh: '最多同时对比 {n} 个方案', en: 'At most {n} alternatives at once' },

  'time.now': { zh: '此刻', en: 'Now' },
  'time.lighting': { zh: '照明 ×{v}', en: 'Lighting ×{v}' },
  'time.crowd': { zh: '人流 ×{v}', en: 'Crowd ×{v}' },
  'time.hourAria': { zh: '出发时刻', en: 'Departure hour' },

  'options.dynamicCost': { zh: '时间相关代价', en: 'Time-dependent cost' },
  'options.dynamicCostHint': { zh: '夜间加大无照明路段的代价，高峰时段考虑人流', en: 'Penalise unlit streets after dark and crowded roads at peak hours' },
  'options.riskPins': { zh: '地图上标注风险点', en: 'Hazard pins on the map' },
  'options.riskPinsHint': { zh: '标出台阶、无照明、无人行道的路段', en: 'Mark steps, unlit and sidewalk-free stretches' },
  'options.autoPlan': { zh: '自动重新计算', en: 'Recompute automatically' },
  'options.autoPlanHint': { zh: '任一条件变化后自动重新规划', en: 'Re-plan whenever a control changes' },
  'options.showFrom': { zh: '显示不低于', en: 'Show pins from' },
  'options.mediaAll': { zh: '全部', en: 'All' },
  'options.mediaCaution': { zh: '注意', en: 'Caution' },
  'options.mediaHigh': { zh: '高', en: 'High' },

  'plan.find': { zh: '规划无障碍路线', en: 'Find accessible route' },
  'plan.recompute': { zh: '重新计算路线', en: 'Recompute route' },
  'plan.computing': { zh: '正在计算…', en: 'Computing route…' },
  'plan.live': { zh: '实时', en: 'live' },
  'plan.autoRecompute': { zh: '输入变化时自动重新计算', en: 'Recompute automatically whenever inputs change' },
  'plan.reset': { zh: '重置', en: 'Reset' },
  'plan.resetHint': { zh: '清除两个点和已算出的路线', en: 'Clear both points and the computed routes' },
  'plan.shortcutHint': { zh: '按 {key} 查看快捷键', en: 'Press {key} for shortcuts' },

  'toolbar.help': { zh: '键盘快捷键', en: 'Keyboard shortcuts' },
  'toolbar.bigTypeOn': { zh: '开启大字号', en: 'Enable large text' },
  'toolbar.bigTypeOff': { zh: '关闭大字号', en: 'Large text is on' },
  'toolbar.motionOn': { zh: '动效已开启', en: 'Animations are on' },
  'toolbar.motionOff': { zh: '动效已关闭', en: 'Animations are off' },
  'toolbar.basemapNow': { zh: '大字号已开启 · {name} 底图', en: 'Large text on · {name} basemap' },

  'map.pickingStart': { zh: '点击地图设置起点', en: 'Click the map to set the start point' },
  'map.pickingEnd': { zh: '点击地图设置终点', en: 'Click the map to set the destination' },
  'map.tilt3d': { zh: '开启 3D 视角（倾斜相机 + 建筑拉伸）', en: 'Tilt the camera and extrude buildings for a 3D view' },
  'map.flat': { zh: '回到平面视角', en: 'Back to flat view' },
  'map.resetNorth': { zh: '正北朝上', en: 'Reset north' },
  'map.terrainHint': { zh: '含真实地形起伏', en: 'includes real terrain relief' },
  'map.no3dBuildings': { zh: '当前为栅格底图，无法拉伸建筑；切到矢量底图可显示 3D 建筑', en: 'Raster basemap: building extrusion needs a vector basemap' },
  'map.switchToVector': { zh: '切到矢量底图', en: 'Switch to vector' },
  'map.tilesFailed': { zh: '底图瓦片加载失败。', en: 'Basemap tiles did not load.' },
  'map.tilesFailedBody': { zh: '路径规划仍然可用 —— 可以换个底图试试。', en: 'Routing still works — try another basemap.' },
  'map.dismiss': { zh: '忽略', en: 'Dismiss' },
  'map.colourBy': { zh: '配色方式', en: 'Colour by' },
  'map.basemap.night': { zh: '夜间', en: 'Night' },
  'map.basemap.nightHint': { zh: '深色矢量底图 —— 搭配霓虹与高对比主题', en: 'Dark vector basemap — pairs with the neon and high-contrast themes' },
  'map.basemap.midnight': { zh: '午夜', en: 'Midnight' },
  'map.basemap.midnightHint': { zh: '深蓝灰矢量底图', en: 'Deep blue-grey vector basemap' },
  'map.basemap.daylight': { zh: '日间', en: 'Daylight' },
  'map.basemap.daylightHint': { zh: '低干扰的浅色矢量底图', en: 'Muted light vector basemap — the least visual noise' },
  'map.basemap.liberty': { zh: '彩色', en: 'Liberty' },
  'map.basemap.libertyHint': { zh: '含公园与建筑的彩色矢量底图', en: 'Colourful vector basemap with parks and buildings' },
  'map.basemap.osm': { zh: '标准', en: 'Standard' },
  'map.basemap.osmHint': { zh: 'OpenStreetMap 栅格瓦片 —— 细节最多，无矢量标注', en: 'OpenStreetMap raster tiles — most detail, no vector labels' },
  'map.basemap.satellite': { zh: '卫星', en: 'Satellite' },
  'map.basemap.satelliteHint': { zh: 'Esri 卫星影像（含地名标注）', en: 'Esri satellite imagery with place labels' },
  'map.basemapGroup': { zh: '底图', en: 'Basemap' },
  'map.threeDOn': { zh: '3D 已开启', en: '3D on' },
  'map.threeDHint': { zh: '3D 已开启：地形起伏 + 建筑拉伸', en: '3D on: terrain relief plus extruded buildings' },
  'map.legendHint': { zh: '点击展开图例，切换分段着色', en: 'Open the legend to switch segment colouring' },
  'map.nodeStats': { zh: '{nodes} 个节点 · {edges} 条边', en: '{nodes} nodes · {edges} edges' },
  'map.routeStats': { zh: '{n} 条路线 · {algo}', en: '{n} routes · {algo}' },
  'map.zoomPrefix': { zh: '缩放', en: 'z' },

  'legend.routeColours': { zh: '路线配色', en: 'Route colours' },

  'results.alternativesOne': { zh: '1 个方案', en: '1 alternative' },
  'results.alternatives': { zh: '{n} 个方案', en: '{n} alternatives' },
  'results.updating': { zh: '更新中', en: 'updating' },
  'results.subtitle': { zh: '{area} 路网 · 步行约 {time}', en: '{area} network · recomputed for {time} of walking' },
  'results.readAloud': { zh: '朗读选中的路线', en: 'Read the selected route aloud' },
  'results.copyLink': { zh: '复制可分享的链接', en: 'Copy a shareable link' },
  'results.copied': { zh: '链接已复制', en: 'Link copied' },
  'results.copiedToast': { zh: '链接已复制 —— 起终点、时刻与方案都已编码在链接里', en: 'Shareable link copied — start, destination, hour and profiles are all encoded' },
  'results.noRoute': { zh: '还没有规划路线', en: 'No route yet' },
  'results.noRouteBody': { zh: '设置起点和终点 —— 可以搜索、点击地图，或跳到一个示例城市。BlindNav 会同时对比多种无障碍偏好方案。', en: 'Pick a start and a destination — search, tap the map, or jump to one of the demo cities. BlindNav then compares several accessibility profiles side by side.' },
  'results.planningFailed': { zh: '规划失败', en: 'Planning failed' },
  'results.planningFailedBody': { zh: '某个城市首次请求需要下载 OpenStreetMap 数据，可能需要几秒。稍后重试通常就能成功。', en: 'The very first request for a city downloads its OpenStreetMap extract, which can take a few seconds. Retrying is usually enough.' },
  'results.retry': { zh: '重试', en: 'Try again' },
  'results.overview': { zh: '总览', en: 'Overview' },
  'results.hazards': { zh: '风险', en: 'Hazards' },
  'results.steps': { zh: '指引', en: 'Steps' },
  'results.slope': { zh: '坡度', en: 'Slope' },
  'results.detailView': { zh: '路线详情视图', en: 'Route detail view' },
  'results.profile': { zh: '无障碍画像', en: 'Accessibility profile' },
  'results.composition': { zh: '路线构成', en: 'Route composition' },
  'results.hazardTimeline': { zh: '风险时间轴', en: 'Hazard timeline' },
  'results.allHazards': { zh: '全部风险记录', en: 'All recorded hazards' },
  'results.turnByTurn': { zh: '逐向指引', en: 'Turn-by-turn' },
  'results.groundProfile': { zh: '地面剖面', en: 'Ground profile' },
  'results.noSlopeData': { zh: '没有坡度数据', en: 'No slope data' },
  'results.noSlopeDataBody': { zh: 'OpenStreetMap 未记录这条路线的坡度值。', en: 'OpenStreetMap records no incline values for this route.' },
  'results.noDirections': { zh: '没有指引', en: 'No directions' },
  'results.noDirectionsBody': { zh: '路线太短，无法拆分为分段指引。', en: 'This route is too short to break into steps.' },
  'results.hazardCount': { zh: '{n} 处风险', en: '{n} hazards' },
  'results.noHazards': { zh: '无风险', en: 'No hazards' },
  'results.noHazardsTitle': { zh: '未检测到风险', en: 'No hazards detected' },
  'results.noHazardsBody': { zh: '这条路线上每一段的 OpenStreetMap 数据都记录了良好的人行道、照明与盲道取值。', en: 'The OpenStreetMap data for every stretch of this route records good sidewalk, lighting and tactile-paving values.' },
  'results.noStretchHazard': { zh: '该路段无风险记录', en: 'No hazards recorded on this stretch' },
  'results.worst': { zh: '最严重', en: 'worst' },
  'results.hazardCountPlain': { zh: '{n} 处', en: '{n}' },
  'results.hoverBand': { zh: '把光标移到色带上即可在地图上定位。', en: 'Hover a band to locate it on the map.' },
  'results.hoverAxis': { zh: '把光标移到某个轴可以看到它的含义', en: 'Hover an axis to see what it measures' },
  'results.hoverProfile': { zh: '把光标移到剖面图上可以读取任意位置的坡度。', en: 'Hover the profile to read the gradient at any point.' },
  'results.segment': { zh: '路段 #{n}', en: 'Segment #{n}' },
  'results.segmentOn': { zh: '属于 {route}', en: 'on {route}' },
  'results.segmentDuration': { zh: '{distance} · 按此速度约 {time}', en: '{distance} · {time} at this pace' },
  'results.closeSegment': { zh: '关闭路段详情', en: 'Close segment details' },
  'results.unnamed': { zh: '未命名', en: 'unnamed' },
  'results.alsoMatches': { zh: '同时满足 {list}', en: 'also {list}' },
  'results.selectedRoute': { zh: '当前选中', en: 'Selected route' },
  'results.selectRoute': { zh: '选择该路线', en: 'Select this route' },
  'results.stepFree': { zh: '全程免台阶', en: 'step-free' },
  'results.stepsSections': { zh: '{n} 处台阶', en: '{n} step sections' },
  'results.scoreAria': { zh: '无障碍评分 {score} 分（满分 100），等级 {grade}', en: 'Accessibility score {score} out of 100, grade {grade}' },
  'badge.bestScore': { zh: '评分最高', en: 'Best score' },
  'badge.fastest': { zh: '最快', en: 'Fastest' },
  'badge.shortest': { zh: '最短', en: 'Shortest' },
  'results.scoreTooltip': { zh: '无障碍评分 {score}/100 —— {band}', en: 'Accessibility score {score}/100 — {band}' },
  'results.grade': { zh: '等级 {grade}', en: 'grade {grade}' },
  'results.statsLine': { zh: '{distance} · {duration} · {steps}', en: '{distance} · {duration} · {steps}' },
  'results.statsLine2': { zh: '{hazards} · 盲道 {tactile} · 照明 {lit}', en: '{hazards} · tactile {tactile} · lit {lit}' },

  'metric.distance': { zh: '距离', en: 'Distance' },
  'metric.time': { zh: '预计用时', en: 'Time' },
  'metric.steps': { zh: '台阶', en: 'Steps' },
  'metric.stepsNone': { zh: '无', en: 'None' },
  'metric.tactile': { zh: '盲道', en: 'Tactile' },
  'metric.lighting': { zh: '照明', en: 'Lighting' },
  'metric.sidewalk': { zh: '人行道', en: 'Sidewalk' },
  'metric.tactilePaving': { zh: '盲道覆盖', en: 'Tactile paving' },
  'metric.streetLighting': { zh: '路灯照明', en: 'Street lighting' },
  'metric.sidewalkPresent': { zh: '人行道覆盖', en: 'Sidewalk present' },
  'metric.roughGround': { zh: '粗糙路面', en: 'Rough ground' },
  'metric.stepsLength': { zh: '台阶长度', en: 'Steps length' },
  'metric.narrowest': { zh: '最窄处', en: 'Narrowest point' },
  'metric.meanSlope': { zh: '平均坡度', en: 'Mean slope' },
  'metric.steepest': { zh: '最陡坡度', en: 'Steepest' },
  'metric.steepStretches': { zh: '陡坡路段', en: 'Steep stretches' },
  'metric.nodes': { zh: '路径节点', en: 'Nodes' },
  'metric.explored': { zh: '搜索节点', en: 'Explored' },
  'metric.unmapped': { zh: '未标注', en: 'unmapped' },
  'metric.roadTypes': { zh: '主要道路类型', en: 'Road types' },
  'metric.highway': { zh: '道路类型', en: 'Highway' },
  'metric.streetName': { zh: '街道名称', en: 'Street name' },
  'metric.barrier': { zh: '{pct}% 门槛', en: '{pct}% barrier' },
  'metric.slopeAria': { zh: '坡度剖面，最大坡度 {pct}%', en: 'Slope profile with a maximum of {pct} percent' },
  'metric.factorAria': { zh: '无障碍因子画像', en: 'Accessibility factor profile' },

  'summary.rated': { zh: '评分 {score}/100：{parts}。', en: 'Rated {score}/100: {parts}.' },
  'summary.shortest': { zh: '最短步行路线 —— {parts}。', en: 'Shortest walk — {parts}.' },
  'summary.stepFree': { zh: '全程无台阶', en: 'step-free' },
  'summary.steps': { zh: '{n} 处台阶', en: '{n} step section(s)' },
  'summary.tactileStrong': { zh: '盲道覆盖良好', en: 'strong tactile paving' },
  'summary.tactilePartial': { zh: '盲道部分覆盖', en: 'partial tactile paving' },
  'summary.tactilePoor': { zh: '盲道较少', en: 'little tactile paving' },
  'summary.litGood': { zh: '照明良好', en: 'well lit' },
  'summary.litPatchy': { zh: '照明不连续', en: 'patchy lighting' },
  'summary.litPoor': { zh: '大部分无照明', en: 'mostly unlit' },
  'summary.sidewalkGood': { zh: '全程有人行道', en: 'sidewalk throughout' },
  'summary.sidewalkPoor': { zh: '人行道不足', en: 'limited sidewalk' },

  'band.excellent': { zh: '优秀', en: 'Excellent' },
  'band.good': { zh: '良好', en: 'Good' },
  'band.fair': { zh: '一般', en: 'Fair' },
  'band.poor': { zh: '较差', en: 'Poor' },
  'band.avoid': { zh: '不建议', en: 'Avoid' },

  'severity.high': { zh: '高', en: 'High' },
  'severity.medium': { zh: '注意', en: 'Caution' },
  'severity.low': { zh: '轻微', en: 'Minor' },
  'severity.none': { zh: '通畅', en: 'Clear' },

  'dir.depart': { zh: '向{cardinal}方向出发', en: 'Head {cardinal}' },
  'dir.departOn': { zh: '向{cardinal}方向出发，沿 {street} 前行', en: 'Head {cardinal} on {street}' },
  'dir.left': { zh: '左转', en: 'Turn left' },
  'dir.right': { zh: '右转', en: 'Turn right' },
  'dir.slightLeft': { zh: '稍向左', en: 'Bear left' },
  'dir.slightRight': { zh: '稍向右', en: 'Bear right' },
  'dir.continueOn': { zh: '继续沿 {street} 前行', en: 'Continue onto {street}' },
  'dir.continue': { zh: '继续直行', en: 'Continue' },
  'dir.uturn': { zh: '掉头', en: 'Make a U-turn' },
  'dir.onto': { zh: '进入 {street}', en: 'onto {street}' },
  'dir.arrive': { zh: '到达目的地', en: 'Arrive at destination' },
  'dir.stepAria': { zh: '第 {n} 步', en: 'Step {n}' },

  'cardinal.n': { zh: '正北', en: 'north' },
  'cardinal.nne': { zh: '北偏东北', en: 'north-northeast' },
  'cardinal.ne': { zh: '东北', en: 'northeast' },
  'cardinal.ene': { zh: '东偏东北', en: 'east-northeast' },
  'cardinal.e': { zh: '正东', en: 'east' },
  'cardinal.ese': { zh: '东偏东南', en: 'east-southeast' },
  'cardinal.se': { zh: '东南', en: 'southeast' },
  'cardinal.sse': { zh: '南偏东南', en: 'south-southeast' },
  'cardinal.s': { zh: '正南', en: 'south' },
  'cardinal.ssw': { zh: '南偏西南', en: 'south-southwest' },
  'cardinal.sw': { zh: '西南', en: 'southwest' },
  'cardinal.wsw': { zh: '西偏西南', en: 'west-southwest' },
  'cardinal.w': { zh: '正西', en: 'west' },
  'cardinal.wnw': { zh: '西偏西北', en: 'west-northwest' },
  'cardinal.nw': { zh: '西北', en: 'northwest' },
  'cardinal.nnw': { zh: '北偏西北', en: 'north-northwest' },

  'shortcuts.title': { zh: '键盘快捷键', en: 'Keyboard shortcuts' },
  'shortcuts.note': { zh: '在输入框中打字时快捷键不会生效。', en: 'Shortcuts are ignored while typing in a field.' },
  'shortcuts.gotIt': { zh: '知道了', en: 'Got it' },
  'shortcuts.close': { zh: '关闭', en: 'Close' },
  'shortcuts.armStart': { zh: '在地图上选起点', en: 'Arm start-point picking on the map' },
  'shortcuts.armEnd': { zh: '在地图上选终点', en: 'Arm destination picking on the map' },
  'shortcuts.plan': { zh: '计算路线', en: 'Compute the route' },
  'shortcuts.focus': { zh: '聚焦某个方案', en: 'Focus an alternative' },
  'shortcuts.factor': { zh: '切换地图着色因子', en: 'Cycle the map colour factor' },
  'shortcuts.theme': { zh: '切换主题（深色 → 亮色 → 高对比）', en: 'Cycle the theme (dark → light → high contrast)' },
  'shortcuts.basemap': { zh: '切换底图', en: 'Cycle the basemap' },
  'shortcuts.terrain3d': { zh: '切换 3D 地形与建筑', en: 'Toggle 3D terrain and buildings' },
  'shortcuts.speak': { zh: '朗读选中的路线', en: 'Read the selected route aloud' },
  'shortcuts.bigType': { zh: '切换大字号', en: 'Toggle large text' },
  'shortcuts.help': { zh: '显示本面板', en: 'Show this panel' },
  'shortcuts.esc': { zh: '取消选点或关闭面板', en: 'Cancel picking or close panels' },

  'theme.dark': { zh: '霓虹夜', en: 'Neon night' },
  'theme.darkHint': { zh: '深空暗色主题', en: 'Deep-space dark theme' },
  'theme.light': { zh: '日光玻璃', en: 'Daylight glass' },
  'theme.lightHint': { zh: '磨砂亮色主题', en: 'Frosted light theme' },
  'theme.contrast': { zh: '高对比', en: 'High contrast' },
  'theme.contrastHint': { zh: '最大可读性，更大字号', en: 'Maximum legibility, larger type' },
  'theme.switchTo': { zh: '切换到{name}主题', en: 'Switch to {name} theme' },

  'error.backendTitle': { zh: '后端未连接。', en: 'Backend unreachable.' },
  'error.offline': { zh: '无法连接到 BlindNav 服务，后端启动了吗？', en: 'Cannot reach the BlindNav service. Is the backend running?' },
  'error.requestFailed': { zh: '请求失败（HTTP {status}）', en: 'Request failed (HTTP {status})' },
  'error.planFailed': { zh: '路线规划失败', en: 'Route planning failed' },
  'error.badCoords': { zh: '请输入有效的经纬度', en: 'Please enter valid coordinates' },
  'error.coordsNumeric': { zh: '经纬度必须是数字', en: 'Coordinates must be numeric lat/lon pairs' },
  'error.graphLoading': { zh: '地图数据正在加载中，请稍后重试（首次加载会从 OpenStreetMap 下载数据）', en: 'Map data still loading, please try again (first launch downloads from OpenStreetMap)' },
  'error.noNetwork': { zh: '起点或终点附近没有路网数据', en: 'No road network data near the requested coordinates' },
  'error.noPath': { zh: '两点之间找不到可行路径', en: 'No feasible path found between start and end' },
  'error.geocode': { zh: '地点搜索服务暂时不可用', en: 'Place search is temporarily unavailable' },
  'error.internal': { zh: '内部错误，请重试', en: 'Internal error, please retry' },

  'skeleton.routes': { zh: '正在计算路线', en: 'Computing routes' },
  'sheet.show': { zh: '规划路线', en: 'Plan a route' },
  'sheet.hide': { zh: '收起面板', en: 'Hide panel' },
  'sheet.plan': { zh: '规划', en: 'Plan' },
  'sheet.results': { zh: '结果', en: 'Results' },
} as const

export type StringKey = keyof typeof DICT

function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in vars ? String(vars[key]) : match,
  )
}

/* ══════════════════════════════════════════════════════════════════
   Backend vocabulary — translated by stable id, never by English text
   ══════════════════════════════════════════════════════════════════ */

type Pair = { zh: string; en: string }

const PROFILE: Record<string, { label: Pair; short: Pair; description: Pair }> = {
  accessible: {
    label: { zh: '最无障碍', en: 'Most Accessible' },
    short: { zh: '无障碍', en: 'Accessible' },
    description: { zh: '优先盲道与人行道覆盖，尽量避开台阶。', en: 'Maximises tactile paving and sidewalk coverage, avoids steps.' },
  },
  fast: {
    label: { zh: '最快', en: 'Fastest' },
    short: { zh: '最快', en: 'Fastest' },
    description: { zh: '步行距离最短，不考虑无障碍舒适度。', en: 'Shortest walking distance, ignores accessibility comfort.' },
  },
  lit: {
    label: { zh: '夜间最亮', en: 'Best Lit' },
    short: { zh: '夜间安全', en: 'Night Safe' },
    description: { zh: '优先照明良好的路段，天黑后最安全。', en: 'Prefers well-lit segments — safest after dark.' },
  },
  wheelchair: {
    label: { zh: '免台阶通行', en: 'Step-Free' },
    short: { zh: '免台阶', en: 'Step-Free' },
    description: { zh: '全程免台阶，路面平整宽敞、坡度平缓。', en: 'Step-free, smooth, wide paths with gentle slopes.' },
  },
}

const FACTOR: Record<string, { label: Pair; description: Pair }> = {
  risk: {
    label: { zh: '风险等级', en: 'Hazard level' },
    description: { zh: '按每段路对视障步行的危险程度着色。', en: 'Colours each stretch by how hostile it is to a blind pedestrian.' },
  },
  tactile: {
    label: { zh: '盲道', en: 'Tactile paving' },
    description: { zh: '沿线的引导铺装覆盖情况。', en: 'Guide-surface coverage along the route.' },
  },
  lighting: {
    label: { zh: '照明', en: 'Lighting' },
    description: { zh: '路灯记录情况，并结合出发时刻加权。', en: 'Records street lighting, weighted for the departure hour.' },
  },
  sidewalk: {
    label: { zh: '人行道', en: 'Sidewalk' },
    description: { zh: '该段是否与机动车道分离。', en: 'Whether the stretch is separated from traffic.' },
  },
  surface: {
    label: { zh: '路面', en: 'Surface' },
    description: { zh: '脚下路面的粗糙程度。', en: 'Ground surface roughness underfoot.' },
  },
  incline: {
    label: { zh: '坡度', en: 'Slope' },
    description: { zh: '每段路的坡度，按百分比分档。', en: 'Gradient of each stretch, bucketed by percent.' },
  },
  width: {
    label: { zh: '宽度', en: 'Width' },
    description: { zh: '最窄处的通行宽度。', en: 'Clearance along the narrowest stretch.' },
  },
}

const FACTOR_VALUE: Record<string, Record<string, Pair>> = {
  tactile: {
    yes: { zh: '有盲道', en: 'Tactile paving' },
    limited: { zh: '盲道有限', en: 'Limited' },
    incorrect: { zh: '盲道不规范', en: 'Incorrect' },
    no: { zh: '无盲道', en: 'None' },
    unknown: { zh: '未标注', en: 'Unmapped' },
  },
  lighting: {
    yes: { zh: '有照明', en: 'Lit' },
    '24/7': { zh: '全天照明', en: 'Lit 24/7' },
    automatic: { zh: '自动照明', en: 'Automatic' },
    limited: { zh: '照明有限', en: 'Limited' },
    no: { zh: '无照明', en: 'Unlit' },
    unknown: { zh: '未标注', en: 'Unmapped' },
  },
  sidewalk: {
    yes: { zh: '有人行道', en: 'Sidewalk' },
    both: { zh: '两侧人行道', en: 'Both sides' },
    separate: { zh: '独立步道', en: 'Separate path' },
    right: { zh: '仅右侧', en: 'Right only' },
    left: { zh: '仅左侧', en: 'Left only' },
    limited: { zh: '人行道有限', en: 'Limited' },
    no: { zh: '无人行道', en: 'None' },
    none: { zh: '无人行道', en: 'None' },
    unknown: { zh: '未标注', en: 'Unmapped' },
  },
  surface: {
    asphalt: { zh: '沥青', en: 'Asphalt' },
    concrete: { zh: '混凝土', en: 'Concrete' },
    'concrete:lanes': { zh: '混凝土板带', en: 'Concrete lanes' },
    'concrete:plates': { zh: '混凝土板', en: 'Concrete plates' },
    paved: { zh: '铺装路面', en: 'Paved' },
    paving_stones: { zh: '石板', en: 'Paving stones' },
    sett: { zh: '方石', en: 'Sett' },
    compacted: { zh: '压实土', en: 'Compacted' },
    fine_gravel: { zh: '细碎石', en: 'Fine gravel' },
    gravel: { zh: '碎石', en: 'Gravel' },
    ground: { zh: '裸地', en: 'Ground' },
    dirt: { zh: '泥土', en: 'Dirt' },
    grass: { zh: '草地', en: 'Grass' },
    sand: { zh: '沙地', en: 'Sand' },
    wood: { zh: '木质', en: 'Wood' },
    metal: { zh: '金属', en: 'Metal' },
    unpaved: { zh: '未铺装', en: 'Unpaved' },
    unknown: { zh: '未标注', en: 'Unmapped' },
  },
  incline: {
    '0-2': { zh: '平坦 (0-2%)', en: 'Flat (0-2%)' },
    '2-5': { zh: '缓坡 (2-5%)', en: 'Gentle (2-5%)' },
    '5-10': { zh: '中坡 (5-10%)', en: 'Moderate (5-10%)' },
    '10+': { zh: '陡坡 (10%+)', en: 'Steep (10%+)' },
  },
  risk: {
    high: { zh: '高风险', en: 'High risk' },
    medium: { zh: '注意', en: 'Caution' },
    low: { zh: '轻微', en: 'Minor' },
    none: { zh: '通畅', en: 'Clear' },
  },
}

const RISK: Record<string, { label: Pair; detail: Pair }> = {
  steps: {
    label: { zh: '台阶', en: 'Steps' },
    detail: { zh: '此段无法避开台阶', en: 'Step-free alternative not available here' },
  },
  no_sidewalk: {
    label: { zh: '无人行道', en: 'No sidewalk' },
    detail: { zh: '需在车道内行走，请靠边缓行', en: 'Walking in the roadway — stay close to the kerb' },
  },
  unlit: {
    label: { zh: '无照明路段', en: 'Unlit section' },
    detail: { zh: 'OpenStreetMap 未记录该段照明', en: 'No lighting recorded in OpenStreetMap' },
  },
  no_tactile: {
    label: { zh: '无盲道', en: 'No tactile paving' },
    detail: { zh: '该段缺少引导铺装', en: 'Guide surface absent on this stretch' },
  },
  rough_surface: {
    label: { zh: '路面不平', en: 'Uneven surface' },
    detail: { zh: '脚下地面粗糙或松动', en: 'Rough or loose ground underfoot' },
  },
  steep: {
    label: { zh: '陡坡', en: 'Steep incline' },
    detail: { zh: '坡度超过 10%', en: 'Slope above 10%' },
  },
  narrow: {
    label: { zh: '路面狭窄', en: 'Narrow path' },
    detail: { zh: '通行宽度不足 1.5 米', en: 'Less than 1.5 m of clearance' },
  },
  poorly_lit: {
    label: { zh: '照明不足', en: 'Poorly lit' },
    detail: { zh: '该段照明记录为 limited', en: 'Lighting recorded as limited' },
  },
  limited_tactile: {
    label: { zh: '盲道有限', en: 'Limited tactile paving' },
    detail: { zh: '该段仅部分铺设引导铺装', en: 'Guide surface only partly present' },
  },
}

const SLOT: Record<string, Pair> = {
  dawn: { zh: '黎明', en: 'Dawn' },
  day: { zh: '白天', en: 'Daytime' },
  dusk: { zh: '黄昏', en: 'Dusk' },
  night: { zh: '夜晚', en: 'Night' },
  late_night: { zh: '深夜', en: 'Late Night' },
}

const AREA: Record<string, Pair> = {
  kl: { zh: '吉隆坡', en: 'Kuala Lumpur' },
  singapore: { zh: '新加坡', en: 'Singapore' },
  tokyo: { zh: '东京', en: 'Tokyo' },
  berlin: { zh: '柏林', en: 'Berlin' },
}

const HIGHWAY: Record<string, Pair> = {
  footway: { zh: '人行步道', en: 'Footway' },
  path: { zh: '小径', en: 'Path' },
  pedestrian: { zh: '步行街', en: 'Pedestrian' },
  steps: { zh: '台阶', en: 'Steps' },
  living_street: { zh: '生活街区道路', en: 'Living St.' },
  residential: { zh: '居住区道路', en: 'Residential' },
  service: { zh: '辅路', en: 'Service' },
  track: { zh: '土路', en: 'Track' },
  unclassified: { zh: '未分类道路', en: 'Unclassified' },
  tertiary: { zh: '三级道路', en: 'Tertiary' },
  secondary: { zh: '二级道路', en: 'Secondary' },
  primary: { zh: '一级道路', en: 'Primary' },
  trunk: { zh: '快速路', en: 'Trunk' },
  crossing: { zh: '人行横道', en: 'Crosswalk' },
  unknown: { zh: '未知道路', en: 'Unknown' },
}

const FACTOR_AXIS: Record<string, Pair> = {
  tactile: { zh: '盲道', en: 'Tactile' },
  lighting: { zh: '照明', en: 'Lighting' },
  sidewalk: { zh: '人行道', en: 'Sidewalk' },
  surface: { zh: '路面', en: 'Surface' },
  incline: { zh: '坡度', en: 'Slope' },
  width: { zh: '宽度', en: 'Width' },
}

const CARDINAL: Pair[] = [
  { zh: '正北', en: 'north' },
  { zh: '北偏东北', en: 'north-northeast' },
  { zh: '东北', en: 'northeast' },
  { zh: '东偏东北', en: 'east-northeast' },
  { zh: '正东', en: 'east' },
  { zh: '东偏东南', en: 'east-southeast' },
  { zh: '东南', en: 'southeast' },
  { zh: '南偏东南', en: 'south-southeast' },
  { zh: '正南', en: 'south' },
  { zh: '南偏西南', en: 'south-southwest' },
  { zh: '西南', en: 'southwest' },
  { zh: '西偏西南', en: 'west-southwest' },
  { zh: '正西', en: 'west' },
  { zh: '西偏西北', en: 'west-northwest' },
  { zh: '西北', en: 'northwest' },
  { zh: '北偏西北', en: 'north-northwest' },
]

const ERROR_CODE: Record<string, StringKey> = {
  graph_loading: 'error.graphLoading',
  no_network: 'error.noNetwork',
  no_path: 'error.noPath',
  missing_coordinates: 'error.badCoords',
  invalid_coordinates: 'error.badCoords',
  geocode_unavailable: 'error.geocode',
  geocode_http_error: 'error.geocode',
  internal_error: 'error.internal',
  offline: 'error.offline',
}

/* ══════════════════════════════════════════════════════════════════
   Public accessors
   ══════════════════════════════════════════════════════════════════ */

const pick = (pair: Pair | undefined, lang: Lang, fallback = ''): string =>
  pair ? pair[lang] : fallback

export function profileText(lang: Lang, id: string) {
  const entry = PROFILE[id]
  return {
    label: pick(entry?.label, lang, id),
    short: pick(entry?.short, lang, id),
    description: pick(entry?.description, lang, ''),
  }
}

export function factorText(lang: Lang, id: string) {
  const entry = FACTOR[id]
  return {
    label: pick(entry?.label, lang, id),
    description: pick(entry?.description, lang, ''),
  }
}

export function factorValueText(lang: Lang, factorId: string, value: string): string {
  return pick(FACTOR_VALUE[factorId]?.[String(value).toLowerCase()], lang, value)
}

export function riskText(lang: Lang, type: string) {
  const entry = RISK[type]
  return {
    label: pick(entry?.label, lang, type),
    detail: pick(entry?.detail, lang, ''),
  }
}

export function slotText(lang: Lang, name: string, fallback = ''): string {
  return pick(SLOT[name], lang, fallback || name)
}

export function areaText(lang: Lang, id: string, fallback = ''): string {
  return pick(AREA[id], lang, fallback || id)
}

export function highwayText(lang: Lang, name: string): string {
  return pick(HIGHWAY[String(name).toLowerCase()], lang, name)
}

export function severityText(lang: Lang, id: string, fallback = ''): string {
  return pick(FACTOR_VALUE.risk?.[id], lang, fallback || id)
}

export function axisLabel(lang: Lang, key: keyof RouteFactors): string {
  return pick(FACTOR_AXIS[key], lang, key)
}

export function errorText(lang: Lang, code: string | null, fallback: string): string {
  const key = code ? ERROR_CODE[code] : undefined
  return key ? pick(DICT[key] as Pair, lang, fallback) : fallback
}

/** 16-point compass name for a bearing in degrees. */
export function cardinalText(lang: Lang, degrees: number): string {
  const pair = CARDINAL[Math.round(((degrees % 360) + 360) % 360 / 22.5) % 16]
  return pick(pair, lang, '')
}

export function scoreBandKey(score: number): StringKey {
  if (score >= 85) return 'band.excellent'
  if (score >= 70) return 'band.good'
  if (score >= 55) return 'band.fair'
  if (score >= 40) return 'band.poor'
  return 'band.avoid'
}

/** Compose a turn instruction in the active language from the structured fields. */
export function directionText(
  lang: Lang,
  direction: Direction,
  street: string | null,
  cardinal: string,
): string {
  const esc = (key: StringKey, vars?: Record<string, string | number>) =>
    interpolate(pick(DICT[key] as Pair, lang), vars)

  // The backend's own English sentence is ignored on purpose: it cannot be
  // translated reliably, so the wording is rebuilt from icon + street instead.
  switch (direction.type) {
    case 'depart':
      return street ? esc('dir.departOn', { cardinal, street }) : esc('dir.depart', { cardinal })
    case 'arrive':
      return esc('dir.arrive')
    case 'uturn':
      return street ? `${esc('dir.uturn')}，${esc('dir.onto', { street })}` : esc('dir.uturn')
    default: {
      const base =
        direction.icon === 'left'
          ? esc('dir.left')
          : direction.icon === 'right'
            ? esc('dir.right')
            : direction.icon === 'slight-left'
              ? esc('dir.slightLeft')
              : direction.icon === 'slight-right'
                ? esc('dir.slightRight')
                : street
                  ? esc('dir.continueOn', { street })
                  : esc('dir.continue')
      const needsOnto = direction.icon !== 'straight' && street
      return needsOnto ? (lang === 'zh' ? `${base}，${esc('dir.onto', { street })}` : `${base}, ${esc('dir.onto', { street })}`) : base
    }
  }
}

/** Compose the one-line route summary in the active language. */
export function summaryText(
  lang: Lang,
  route: RoutePlan,
  t: (key: StringKey, vars?: Record<string, string | number>) => string,
): string {
  const parts: string[] = []
  parts.push(route.metrics.steps_count === 0 ? t('summary.stepFree') : t('summary.steps', { n: route.metrics.steps_count }))
  parts.push(
    route.metrics.tactile_pct >= 60
      ? t('summary.tactileStrong')
      : route.metrics.tactile_pct >= 25
        ? t('summary.tactilePartial')
        : t('summary.tactilePoor'),
  )
  parts.push(
    route.metrics.lit_pct >= 80 ? t('summary.litGood') : route.metrics.lit_pct >= 40 ? t('summary.litPatchy') : t('summary.litPoor'),
  )
  if (route.metrics.sidewalk_pct >= 80) parts.push(t('summary.sidewalkGood'))
  else if (route.metrics.sidewalk_pct < 30) parts.push(t('summary.sidewalkPoor'))

  if (route.id === 'fast') return t('summary.shortest', { parts: parts.join(lang === 'zh' ? '、' : ', ') })
  return t('summary.rated', { score: route.score, parts: parts.join(lang === 'zh' ? '、' : ', ') })
}

/* ══════════════════════════════════════════════════════════════════
   Context
   ══════════════════════════════════════════════════════════════════ */

interface I18nValue {
  lang: Lang
  setLang: (lang: Lang) => void
  toggleLang: () => void
  t: (key: StringKey, vars?: Record<string, string | number>) => string
}

const I18nContext = createContext<I18nValue | null>(null)
const STORAGE_KEY = 'blindnav.lang'

function readLang(): Lang {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'zh' || stored === 'en') return stored
  } catch {
    /* storage is optional */
  }
  // Chinese is the default for this UI; English stays available via the toggle.
  return 'zh'
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(readLang)

  useEffect(() => {
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en'
    try {
      localStorage.setItem(STORAGE_KEY, lang)
    } catch {
      /* storage is optional */
    }
  }, [lang])

  const setLang = useCallback((next: Lang) => setLangState(next), [])
  const toggleLang = useCallback(() => setLangState((current) => (current === 'zh' ? 'en' : 'zh')), [])

  const t = useCallback(
    (key: StringKey, vars?: Record<string, string | number>) =>
      interpolate(pick(DICT[key] as Pair, lang, key), vars),
    [lang],
  )

  const value = useMemo<I18nValue>(() => ({ lang, setLang, toggleLang, t }), [lang, setLang, toggleLang, t])
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nValue {
  const value = useContext(I18nContext)
  if (!value) throw new Error('useI18n must be used inside <I18nProvider>')
  return value
}
