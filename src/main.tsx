import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { applyDeviceClass } from './utils/deviceCapabilities'

// كشف الأجهزة الضعيفة فورًا قبل أي رندر — يطبق فئة low-end-device على <html>
// لتعطيل المؤثرات الثقيلة (animations / backdrop-filter / will-change) عبر CSS
applyDeviceClass();

// Defer non-critical initialization
requestIdleCallback(() => {
  import('./utils/security').then(m => m.SecurityUtils.cleanupLocalStorage());
  import('./utils/privacy').then(m => m.PrivacyUtils.initializePrivacyProtection());
}, { timeout: 5000 });

const container = document.getElementById("root")!;
createRoot(container).render(<App />);
