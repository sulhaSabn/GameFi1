# BRICS — Server-authoritative Rewards

این نسخه Backend و Frontend را روی یک Origin اجرا می‌کند.

## ویژگی‌های این نسخه

- امتیاز بازی در MongoDB ذخیره می‌شود.
- امتیاز ارسالی از فرانت‌اند فقط برای ثبت `score` است؛ مقدار پاداش را Backend تعیین می‌کند.
- هر Session بازی یک‌بار قابل ثبت است.
- محدودیت روزانه بازی و حداکثر امتیاز روزانه در Backend اعمال می‌شود.
- نرخ ثابت مالی: **1000 امتیاز = 0.001 USD** (یعنی 1,000,000 امتیاز = 1 USD).
- تبلیغات از پنل Admin ساخته، فعال/غیرفعال و حذف می‌شوند.
- برای هر تبلیغ می‌توان عنوان، لینک، امتیاز، زمان مشاهده و سقف روزانه کاربر را تعیین کرد.
- پاداش تبلیغ نیز مستقیماً در User و Transaction دیتابیس ثبت می‌شود.
- فرانت‌اند آدرس API را نمایش نمی‌دهد و امکان تغییر آن ندارد.
- Backend فایل `BRICS-index.html` را در `/` سرو می‌کند و Frontend فقط از `/api` استفاده می‌کند.

## نصب

```bash
npm install
```

`.env.example` را به `.env` کپی کنید و حداقل این موارد را تنظیم کنید:

```env
PORT=3000
MONGODB_URI=mongodb+srv://...
JWT_SECRET=یک-کلید-طولانی-تصادفی
JWT_EXPIRES_IN=7d
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=change_this
POINTS_PER_USD=1000000
MIN_GAME_SECONDS=5
MIN_AD_SECONDS=10
```

## اجرا

```bash
npm start
```

سایت:

```text
http://localhost:3000/
```

ساخت Admin:

```bash
npm run create-admin
```

## API بازی

- `GET /api/games`
- `POST /api/games/:id/start`
- `POST /api/games/:id/complete`

## API تبلیغات

کاربر:

- `GET /api/ads`
- `POST /api/ads/:id/start`
- `POST /api/ads/:id/complete`

مدیر:

- `GET /api/ads/admin/all`
- `POST /api/ads/admin`
- `PATCH /api/ads/admin/:id`
- `DELETE /api/ads/admin/:id`

## نکته درباره مشاهده تبلیغ

Backend زمان سپری‌شده از شروع Session را بررسی می‌کند و بعد پاداش را ثبت می‌کند. این مکانیزم جلوی ثبت فوری و تکراری را می‌گیرد، اما هیچ وب‌سایتی نمی‌تواند صرفاً با JavaScript ثابت کند که کاربر واقعاً محتوای یک تبلیغ خارجی را دیده است. برای تبلیغات شبکه‌ای که callback/server-to-server دارند، می‌توان تأیید شبکه تبلیغاتی را نیز در Backend اضافه کرد.

## نکته مالی

درخواست برداشت همچنان فقط در دیتابیس ثبت می‌شود و انتقال واقعی USDT انجام نمی‌دهد. پرداخت واقعی باید جداگانه با کیف پول امن، صف پرداخت و کنترل‌های امنیتی پیاده‌سازی شود.
