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
  })

i18n.on("languageChanged", applyDocumentDirection)

export default i18n
