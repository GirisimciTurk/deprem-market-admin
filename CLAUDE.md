# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Komutlar

```bash
npm run dev        # Vite dev sunucusu
npm run build      # tsc -b && vite build  ← tip hataları YALNIZCA burada yakalanır
npm run lint       # eslint .
npm test           # vitest run

npx vitest run src/lib/format.spec.ts        # tek dosya
npx vitest run -t "formatMoney"              # tek test (isme göre)
npx tsc -b --noEmit                          # hızlı tip denetimi (build'siz)
```

ESLint `tseslint.configs.recommended` kullanır — **tip-farkındalıklı kurallar kapalı**. Tip hataları
yalnızca `tsc -b` ile ortaya çıkar, o yüzden değişiklik sonrası `npm run build` veya `npx tsc -b --noEmit` çalıştır.

Test altyapısı neredeyse yok: sadece `src/lib/cargo.spec.ts` ve `src/lib/format.spec.ts`.
testing-library kurulu değil; bileşen/sayfa testi yazma altyapısı yok.

## Deploy — dikkat

`.github/workflows/deploy.yml`: **`main`'e her push canlı VPS'e otomatik deploy tetikler**
(rsync + sunucuda build + restart). `main`'e doğrudan push etme; dal aç ve PR ile ilerle.

## Ekosistem

Bu panel tek başına çalışmaz. Kardeş repolar (`../` altında):

| Repo | Rol |
|---|---|
| `deprem-market-backend` | Medusa v2 — tüm iş mantığı, `/admin/*` ve `/vendors/*` uçları |
| `deprem-market-vendor` | Satıcı paneli (ürün ekleme/düzenleme, sipariş, stok) |
| `deprem-market-storefront` | Next.js müşteri vitrini |
| `deprem-market-admin` | **bu repo** — kontrol merkezi |

Bir özellik çoğu zaman backend + en az bir panel birlikte değişmeyi gerektirir. Backend'in
entegrasyon testleri gerçek Postgres'e karşı koşar (`deprem-market-backend`'de
`npm run test:integration:http`, `deprem-market-test-pg` container'ı gerekir) ve panel
davranışını doğrulamanın en güvenilir yoludur.

**Sorumluluk sınırı** (`Sidebar.tsx:44-46`): admin = gözetim, moderasyon, yapılandırma, ödeme.
Satış operasyonu (ürün oluşturma, stok, kargo) satıcı paneline aittir. Bu yüzden `/inventory` ve
`/stock-movements` route'ları var ama sidebar'da görünmezler.

## Mimari

### API katmanı
`src/lib/api.ts` — axios yok, ~90 satırlık `fetch` sarmalayıcı. `api.get/post/put/delete`.

- **Yalnız `get` params alır**; `post`/`put` sadece body alır, `delete` hiçbiri. POST'ta query
  string gerekiyorsa endpoint string'ine elle ekle.
- Params serileştirmede `undefined` **ve boş string** düşürülür (`api.ts:20-27`) — sayfaların
  `q: search || undefined` yazmasının sebebi bu. `null` düşmez, `"null"` olarak gider.
- Hatalar tek `ApiError` (`message`, `status`). **`status: 0` = sunucuya hiç ulaşılamadı.**
- **401 global ve imperatif** (`api.ts:46-53`): token silinir, `window.location.href = '/login'`
  ile tam sayfa yönlenir. react-query interceptor'ı veya refresh-token akışı yoktur.
- `204`/boş gövde `undefined as T` döner — void uçlarda `T` yalan söyler.

Kimlik: JWT `localStorage['dm_admin_token']` (`auth.ts:5`). Giriş `/auth/user/emailpass`'e ham
`fetch` ile yapılır (henüz token yok). **Kimlikli tüm istekler `/admin/*` önekini kullanır** —
`/store/*` çağrısı yoktur. Uçların çoğu Medusa core değil, backend'de yazılmış özel route'lardır
(`/admin/seller-scorecards`, `/admin/commission-rules`, `/admin/product-approvals`, ...).

### Veri çekme
Servis katmanı **yok**. Her sayfa `queryFn` içinde doğrudan `api.get` çağırır.

`queryKey` = düz dizi, `[kaynakAdı, ...isteğiEtkileyenTümState]`:

```ts
queryKey: ['orders', offset, debouncedSearch, statusFilter],
placeholderData: keepPreviousData,
```

Invalidation çıplak kaynak adıyla prefix eşleşmesi yapar: `qc.invalidateQueries({ queryKey: ['orders'] })`
tüm offset/filtre kombinasyonlarını tazeler. Kaynaklar arası invalidation elle ve açıktır.

Liste sayfalarının değişmeyen iskeleti: modül düzeyinde `const LIMIT = 20`, `useDebounce(search)`
(350ms), her filtre setter'ı ayrıca `setOffset(0)` çağırır, ve şu merdiven:
`isLoading → <LoadingState/>` · `isError → <ErrorState onRetry={refetch}/>` · `boş → <EmptyState/>` · `<table>`.
Mutation'lar: `onSuccess` → `notify()` + `invalidateQueries`, `onError: (e: Error) => notify(e.message, 'error')`.

Medusa v2 `fields` parametresi modül düzeyinde string sabit olarak tutulur
(`const ORDER_FIELDS = 'id,display_id,*items,summary.*'`) — ilişki sözdizimi (`*items`) yük taşır,
elle ayarlanmıştır, gelişigüzel değiştirme.

### Yerleşim ve yönlendirme
`AppLayout` **yalnızca** `<Sidebar />` + `<Outlet />` render eder — `Header`'ı render **etmez**.
**Her sayfa kendi `<Header title subtitle actions />`'ını ilk eleman olarak render etmek zorundadır.**
Unutulursa sayfa başlıksız ve bildirim zilsiz açılır. Bu, en sık yapılan hata.

İki katmanlı koruma, şekilleri farklı:
- `<ProtectedRoute />` — `<Outlet />`'li layout route, sadece token **varlığına** bakar (süre doğrulamaz).
- `<RoleGuard>` — children sarmalayıcı, route başına inline uygulanır.

Login/forgot/reset eager, diğer 30+ sayfa `lazy()`. QueryClient varsayılanları: `staleTime: 60_000`,
`retry: 1`, `refetchOnWindowFocus: false`.

**Yeni sayfa eklemek üç dosyaya dokunmayı gerektirir**: `App.tsx` (`lazy()` + `<Route>`),
`Sidebar.tsx` (`navGroups`), ve admin'e özelse `roles.ts` (`ADMIN_ONLY_PATHS`).

### RBAC
`src/lib/roles.ts` — iki rol: `admin | staff`. Rol Medusa `user.metadata.role`'dan okunur,
varsayılan `admin`. Yetki tek bir sabit dizidir (`ADMIN_ONLY_PATHS`), `canAccess(role, path)`
prefix eşleşmesiyle bakar. **Aynı `canAccess` hem `RoleGuard`'ı hem Sidebar menüsünü besler**,
böylece menü ile erişim birbirinden ayrışamaz.

Bu yalnızca UI kısıtıdır — dosyanın kendi notu: *"tam güvenlik için backend'de de role-middleware
eklenmeli"*. Gerçek yetkilendirmeye backend'de güven.

### Stil
Tailwind yok, CSS modules yok, CSS-in-JS yok. **Global CSS + CSS değişkenleri + yoğun inline `style={{}}`**
(sayfalarda ~1300 inline stil objesi — baskın mekanizma bu).

- `src/styles/globals.css` — tek `:root` bloğu (`:3-49`) tüm değişkenleri tanımlar:
  `--bg-*`, `--border-*`, `--text-*`, `--accent-primary #F08C1A` (marka turuncusu),
  `--accent-success/warning/danger/info` (+ her birinin `-light` rgba eşi),
  `--shadow-*`, `--radius-*`, `--sidebar-width`, `--header-height`. Dark mode yok.
- Global sınıflar import'suz kullanılır: `.badge--*`, `.btn--*`, `.card`, `.table-container`.
- `src/components/ui/ui.css` — `.modal*`, `.pagination*`, `.toast*`, `.field*`, `.muted`, `.row-actions`.

UI primitifleri (`src/components/ui/`) ve tuzakları:
- `Badge` **string değil `StatusMeta` objesi** alır: `<Badge status={orderStatus(o.status)} />`.
- `StateBox` dosyası **iki** bileşen dışa aktarır: `EmptyState` ve `ErrorState` (dosya adı ikisini de tutmaz).
- `useToast` **`toast-context.ts`'ten** import edilir, `Toast.tsx`'ten değil (react-refresh lint kuralı).
- `Pagination` sayfa numarası değil **offset** tabanlıdır: `onChange(offset)`.
- `ConfirmDialog` mutation sırasında kapanmayı engeller (`loading` iken `onClose` no-op).

### Durum etiketleri
`src/lib/statusLabels.ts` — backend enum'larını Türkçe etiket + `BadgeVariant`'a çeviren merkezi tablo
(`orderStatus`, `paymentStatus`, `productStatus`, `serviceRequestStatus`, ...). Bilinmeyen anahtar
zarifçe `{ label: key, variant: 'neutral' }`'a düşer. **Backend'e yeni durum eklendiğinde burada tek
satır eklenir, başka hiçbir yerde değil.**

## Dil

Arayüz tamamen **Türkçe**, i18n altyapısı yok — string'ler kullanıldıkları yerde sabit.
Yerelleştirme `Intl` ve `date-fns/locale/tr` ile yapılır (`src/lib/format.ts`).

Yorumlar karışık: eski altyapı dosyaları İngilizce (`api.ts`, `types.ts`), yeni özellik kodu Türkçe
(`roles.ts`, `Sidebar.tsx`, `App.tsx`). **Düzenlediğin dosyanın yerel diline uy.**

## Tuzaklar

**Para iki uyumsuz birimde tutulur.** `formatMoney` 100'e böler (Medusa minor unit); `formatLira`
**bölmez**, çünkü özel hizmet talebi tutarları tam lira saklanır (`format.ts:32-38`). Form
gidiş-dönüşlerinde `toMajor`/`toMinor` kullan. Yanlış yardımcıyı seçmek sessiz 100× hatadır.

**Görsel URL'leri `toReachableImageUrl`'den geçmeli** (`src/lib/image-url.ts`). Cloudflare R2'nin
`pub-*.r2.dev` host'u bazı Türk ISS'lerinde SNI tabanlı TCP RST ile engelleniyor; yardımcı bunları
backend'in `/r2/` nginx ters vekiline yönlendirir. Ham R2 URL'i dev'de çalışır, gerçek kullanıcıda
`ERR_CONNECTION_RESET` verir.

**İki rakip onay kalıbı var.** `ConfirmDialog` hedeflenen yön, ama 16 dosyada hâlâ 21 `window.confirm()`
çağrısı duruyor. Yeni kodda `ConfirmDialog` kullan.

**`@/` path alias yok.** `vite.config.ts` 7 satır, `tsconfig.app.json`'da `paths` tanımlı değil.
Tüm import'lar göreli (`../../lib/api`).

**`src/lib/types.ts` bilerek kısmidir** — yalnız panelin kullandığı alanlar tiplenmiş. Birçok sayfa
yanıt tipini yerel `interface` olarak tanımlar; iki kalıp bir arada yaşar.

**`README.md` dokunulmamış Vite şablonudur** — bu uygulama hakkında hiçbir bilgi içermez, yanıltıcıdır.
