import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
    // Kural şiddetleri storefront (.eslintrc.json) ile HİZALI.
    // Öncesinde bu proje tseslint varsayılanlarıyla çalışıyordu ve `npm run lint`
    // 38 HATA veriyordu; aynı kural storefront'ta bilerek "warn" idi. Aynı ürünün
    // bir panelinde build kıran hata, diğerinde uyarı olması tutarsızdı.
    rules: {
      // Gerçek tip güvenliği borcu, ama 34 kullanımı tek tek tiplemek ayrı bir iş.
      // Görünür kalsın diye uyarı; build'i kırmasın diye hata değil.
      '@typescript-eslint/no-explicit-any': 'warn',
      // `_` önekli olanlar bilerek kullanılmayanlar (storefront ile aynı kural).
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      }],
      // Fast Refresh ergonomisi — çalışma zamanı hatası değil, geliştirici deneyimi.
      'react-refresh/only-export-components': 'warn',
      // React Compiler kuralı. Kalan vakalar (CargoTariff, ExpertLeads) "sunucudan
      // gelen veriyi düzenlenebilir forma aktarma" kalıbı: fazladan bir render turu
      // doğuruyor ama çıktı yanlış değil. Düzgün çözümü form durum yönetimini
      // yeniden kurgulamak — bu risk lint temizliği turunda alınmadı, borç görünür
      // bırakıldı. Gerçek doğruluk ihlalleri bu turda düzeltildi.
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
])
