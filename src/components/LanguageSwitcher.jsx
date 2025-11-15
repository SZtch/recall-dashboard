// src/components/LanguageSwitcher.jsx
import { useState } from "react";
import { useTranslation } from "react-i18next";

const LANGUAGES = [
  { code: "en", name: "English", flag: "🇬🇧" },
  { code: "id", name: "Indonesian", flag: "🇮🇩" },
  { code: "zh", name: "中文", flag: "🇨🇳" },
];

export default function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  const currentLanguage = LANGUAGES.find((lang) => lang.code === i18n.language) || LANGUAGES[0];

  const changeLanguage = (langCode) => {
    i18n.changeLanguage(langCode);
    localStorage.setItem("language", langCode);
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 rounded-lg border border-neutral-700/50 bg-neutral-800/50 px-2 py-2 sm:px-3 text-sm font-medium text-white transition-all hover:border-neutral-600 hover:bg-neutral-700/50 active:scale-95"
        aria-label="Select Language"
      >
        <span className="text-xl sm:text-base">{currentLanguage.flag}</span>
        <span className="hidden sm:inline">{currentLanguage.code.toUpperCase()}</span>
        <svg
          className={`hidden sm:block h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown */}
          <div className="absolute right-0 top-full z-50 mt-2 rounded-lg border border-neutral-700/50 bg-neutral-900/95 shadow-xl backdrop-blur-sm">
            <div className="flex gap-1 p-2">
              {LANGUAGES.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => changeLanguage(lang.code)}
                  className={`flex items-center justify-center rounded-lg px-3 py-2 text-2xl transition-all hover:bg-neutral-800/80 ${
                    i18n.language === lang.code
                      ? "bg-emerald-500/20 ring-2 ring-emerald-500/50"
                      : "bg-neutral-800/40"
                  }`}
                  title={lang.name}
                >
                  {lang.flag}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
