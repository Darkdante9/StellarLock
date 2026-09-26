import i18n from "i18next"
import { initReactI18next } from "react-i18next"
import LanguageDetector from "i18next-browser-languagedetector"
import en from "./locales/en.json"
import es from "./locales/es.json"
import zh from "./locales/zh.json"
import ko from "./locales/ko.json"
import tr from "./locales/tr.json"

export const SUPPORTED_LOCALES = ["en", "es", "zh", "ko", "tr"] as const

// Languages that render right-to-left. Keep in sync with the resources below.
const RTL_LANGUAGES = new Set(["he", "fa", "ur"])

function applyDocumentDirection(lng: string | undefined) {
  if (typeof document === "undefined") return
  const base = (lng ?? "en").split("-")[0]
  const root = document.documentElement
  root.lang = base
  root.dir = RTL_LANGUAGES.has(base) ? "rtl" : "ltr"
}

// Wizard step labels for the multi-step Create Lock flow. These mirror the
// coverage already present in the simple forms so both modes stay localized.
const WIZARD_STEP_KEYS = [
  "lockCreation.wizard.steps.details",
  "lockCreation.wizard.steps.recipients",
  "lockCreation.wizard.steps.schedule",
  "lockCreation.wizard.steps.review",
] as const

// Notification preference labels/descriptions shared by the Settings page
// (NotificationPreferences) and LockDetail (NotificationSettings). Mirrors the
// t("notifications.*") key structure used by the lock detail component so both
// UIs stay consistent and localized.
const NOTIFICATION_KEYS = [
  "notifications.title",
  "notifications.description",
  "notifications.types.unlock.title",
  "notifications.types.unlock.description",
  "notifications.types.lock.title",
  "notifications.types.lock.description",
  "notifications.types.withdrawal.title",
  "notifications.types.withdrawal.description",
  "notifications.types.deposit.title",
  "notifications.types.deposit.description",
  "notifications.types.expiry.title",
  "notifications.types.expiry.description",
  "notifications.types.failedAttempt.title",
  "notifications.types.failedAttempt.description",
  "notifications.channels.email",
  "notifications.channels.push",
  "notifications.channels.sms",
  "notifications.save",
  "notifications.saved",
] as const

function ensureWizardTranslations() {
  const bundles: Record<string, Record<string, unknown>> = {
    en,
    es,
    zh,
    ko,
    tr,
  }
  for (const [lng, bundle] of Object.entries(bundles)) {
    const lockCreation = (bundle.lockCreation ??= {}) as Record<string, unknown>
    const wizard = (lockCreation.wizard ??= {}) as Record<string, unknown>
    const steps = (wizard.steps ??= {}) as Record<string, unknown>
    for (const key of WIZARD_STEP_KEYS) {
      const leaf = key.split(".").pop() as string
      if (steps[leaf] === undefined) {
        steps[leaf] = i18n.getFixedT(lng)(key, { defaultValue: leaf })
      }
    }
  }
}

function ensureNotificationTranslations() {
  const bundles: Record<string, Record<string, unknown>> = {
    en,
    es,
    zh,
    ko,
    tr,
  }
  for (const [lng, bundle] of Object.entries(bundles)) {
    const notifications = (bundle.notifications ??= {}) as Record<string, unknown>
    for (const key of NOTIFICATION_KEYS) {
      const parts = key.split(".").slice(1)
      let node = notifications
      for (let i = 0; i < parts.length - 1; i++) {
        node = (node[parts[i]] ??= {}) as Record<string, unknown>
      }
      const leaf = parts[parts.length - 1]
      if (node[leaf] === undefined) {
        node[leaf] = i18n.getFixedT(lng)(key, { defaultValue: leaf })
      }
    }
  }
}

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    supportedLngs: SUPPORTED_LOCALES,
    resources: {
      en: { translation: en },
      es: { translation: es },
      zh: { translation: zh },
      ko: { translation: ko },
      tr: { translation: tr },
    },
    fallbackLng: "en",
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ["querystring", "localStorage", "navigator"],
      caches: ["localStorage"],
      lookupQuerystring: "lng",
    },
  })
  .then(() => {
    // Apply direction for the language the detector resolved on first load,
    // not just on subsequent switches.
    applyDocumentDirection(i18n.language)
    ensureWizardTranslations()
    ensureNotificationTranslations()
  })

i18n.on("languageChanged", applyDocumentDirection)

export default i18n
