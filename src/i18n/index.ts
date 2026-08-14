import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';

import { common } from './locales/uk/common';

void i18next.use(initReactI18next).init({
  resources: {
    uk: {
      common,
    },
  },
  lng: 'uk',
  fallbackLng: 'uk',
  defaultNS: 'common',
  ns: ['common'],
  interpolation: {
    escapeValue: false,
  },
});

document.documentElement.lang = 'uk';

export default i18next;
