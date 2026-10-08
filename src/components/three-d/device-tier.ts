/**
 * "Low power" only for genuinely weak devices. Core count is NOT used: iOS Safari under-reports it
 * (iPhones have strong GPUs but say 2–4 cores), which used to drop phones into blurry 1× rendering.
 * deviceMemory exists on Android/Chrome only; ≤ 2 GB there means a budget phone.
 */
const LOW_MEMORY_GB = 2;

export const isLowPowerDevice = (): boolean => {
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  return memory !== undefined && memory <= LOW_MEMORY_GB;
};
