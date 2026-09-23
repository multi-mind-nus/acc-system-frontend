export const aiThresholdPresets = [
  { value: '0.950', level: 'moreAutomatic' },
  { value: '0.980', level: 'balanced' },
  { value: '0.995', level: 'moreManual' },
] as const

export function aiThresholdLevel(value: string | undefined) {
  return aiThresholdPresets.find(preset => Number(preset.value) === Number(value))?.level ?? 'existing'
}
