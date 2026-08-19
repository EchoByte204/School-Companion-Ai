export type LanguageCode =
  "en" | "hi" | "ta" | "te" | "mr" | "bn" | "gu" | "pa" | "kn" | "ml" | "ur";

export type LanguageOption = {
  code: LanguageCode;
  label: string;
  nativeLabel: string;
  /** BCP-47 tag used by browser speech recognition and speech synthesis. */
  speechTag: string;
};

export const LANGUAGES: LanguageOption[] = [
  { code: "en", label: "English", nativeLabel: "English", speechTag: "en-IN" },
  { code: "hi", label: "Hindi", nativeLabel: "हिन्दी", speechTag: "hi-IN" },
  { code: "ta", label: "Tamil", nativeLabel: "தமிழ்", speechTag: "ta-IN" },
  { code: "te", label: "Telugu", nativeLabel: "తెలుగు", speechTag: "te-IN" },
  { code: "mr", label: "Marathi", nativeLabel: "मराठी", speechTag: "mr-IN" },
  { code: "bn", label: "Bengali", nativeLabel: "বাংলা", speechTag: "bn-IN" },
  { code: "gu", label: "Gujarati", nativeLabel: "ગુજરાતી", speechTag: "gu-IN" },
  { code: "pa", label: "Punjabi", nativeLabel: "ਪੰਜਾਬੀ", speechTag: "pa-IN" },
  { code: "kn", label: "Kannada", nativeLabel: "ಕನ್ನಡ", speechTag: "kn-IN" },
  { code: "ml", label: "Malayalam", nativeLabel: "മലയാളം", speechTag: "ml-IN" },
  { code: "ur", label: "Urdu", nativeLabel: "اردو", speechTag: "ur-IN" },
];

const LANGUAGE_MAP = new Map(LANGUAGES.map((language) => [language.code, language]));

export function isLanguageCode(value: string): value is LanguageCode {
  return LANGUAGE_MAP.has(value as LanguageCode);
}

export function getLanguage(code: string): LanguageOption {
  return LANGUAGE_MAP.get(code as LanguageCode) ?? LANGUAGES[0]!;
}
