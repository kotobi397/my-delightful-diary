// كشف قدرات الجهاز - يحدد إن كان الجهاز ضعيفًا لتعطيل المؤثرات الثقيلة
// يُستخدم للوصول إلى أداء جيد على الهواتف الضعيفة بدون استنزاف الذاكرة

export interface DeviceCapabilities {
  isLowEnd: boolean;
  deviceMemory: number;          // GB (تقدير)
  hardwareConcurrency: number;   // عدد الأنوية
  effectiveType: string;         // نوع الشبكة
  saveData: boolean;
  prefersReducedMotion: boolean;
}

let cached: DeviceCapabilities | null = null;

export function detectDeviceCapabilities(): DeviceCapabilities {
  if (cached) return cached;

  if (typeof window === 'undefined') {
    return {
      isLowEnd: false,
      deviceMemory: 8,
      hardwareConcurrency: 4,
      effectiveType: '4g',
      saveData: false,
      prefersReducedMotion: false,
    };
  }

  const nav: any = navigator;
  const deviceMemory: number = nav.deviceMemory ?? 4;
  const hardwareConcurrency: number = nav.hardwareConcurrency ?? 4;
  const connection = nav.connection || nav.mozConnection || nav.webkitConnection;
  const effectiveType: string = connection?.effectiveType ?? '4g';
  const saveData: boolean = connection?.saveData ?? false;
  const prefersReducedMotion =
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

  // اعتبر الجهاز ضعيفًا إذا:
  // - ذاكرة <= 2GB، أو
  // - أنوية <= 2، أو
  // - شبكة 2g/slow-2g، أو
  // - وضع توفير البيانات، أو
  // - المستخدم يفضل تقليل الحركة
  const isLowEnd =
    deviceMemory <= 2 ||
    hardwareConcurrency <= 2 ||
    effectiveType === '2g' ||
    effectiveType === 'slow-2g' ||
    saveData ||
    prefersReducedMotion;

  cached = {
    isLowEnd,
    deviceMemory,
    hardwareConcurrency,
    effectiveType,
    saveData,
    prefersReducedMotion,
  };

  return cached;
}

// تطبيق فئة CSS على <html> ليتم تعطيل المؤثرات الثقيلة عبر CSS
export function applyDeviceClass(): DeviceCapabilities {
  const caps = detectDeviceCapabilities();
  if (typeof document === 'undefined') return caps;
  const root = document.documentElement;
  if (caps.isLowEnd) root.classList.add('low-end-device');
  if (caps.saveData) root.classList.add('save-data');
  return caps;
}

export function isLowEndDevice(): boolean {
  return detectDeviceCapabilities().isLowEnd;
}
