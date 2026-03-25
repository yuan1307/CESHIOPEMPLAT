
import React, { createContext, useContext, useState, ReactNode, useMemo } from 'react';
import { Language } from './types';
import { translations } from './translations';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: typeof translations.en;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<Language>('en');

  const t = useMemo(() => {
      const en = translations.en;
      const current = translations[language];

      // If English, return directly
      if (language === 'en') return en;

      // Recursive Deep Merge to ensure every key in 'en' exists in the result
      const merge = (base: any, target: any): any => {
          if (!target) return base;
          
          const result: any = { ...base };
          
          Object.keys(base).forEach(key => {
              const baseValue = base[key];
              const targetValue = target[key];

              if (targetValue === undefined) {
                  // Key missing in target, keep base (English)
                  result[key] = baseValue;
              } else if (
                  typeof baseValue === 'object' && 
                  baseValue !== null && 
                  !Array.isArray(baseValue) &&
                  typeof targetValue === 'object' && 
                  targetValue !== null && 
                  !Array.isArray(targetValue)
              ) {
                  // Both are objects, merge recursively
                  result[key] = merge(baseValue, targetValue);
              } else {
                  // Primitive or Array, target overrides base
                  result[key] = targetValue;
              }
          });
          return result;
      };

      // We explicitly cast the result to typeof translations.en to satisfy TS
      return merge(en, current) as typeof translations.en;
  }, [language]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
