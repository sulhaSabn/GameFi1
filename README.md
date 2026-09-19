# BRICS Backend + Frontend

نسخه یکپارچه Backend و `BRICS-index.html` برای پلتفرم بازی و پاداش.

## نصب

```bash
npm install
```

فایل `.env.example` را به `.env` کپی کنید و `MONGODB_URI` و `JWT_SECRET` را تنظیم کنید.

## اجرا

```bash
npm start
```

ساخت Admin:

```bash
npm run create-admin
```

## API اصلی

- POST `/api/auth/register`
- POST `/api/auth/login`
- GET `/api/auth/me`
- GET `/api/games`
- POST `/api/games/:id/start`
- POST `/api/games/:id/complete`
- GET `/api/users/transactions`
- GET `/api/users/profile`
- PATCH `/api/users/profile`
- POST `/api/withdrawals`
- GET `/api/withdrawals/my`
- PATCH `/api/withdrawals/admin/:id`

## اصلاحات مهم

1. Frontend اکنون `sessionId` را از شروع بازی ذخیره و هنگام پایان ارسال می‌کند.
2. پاداش بازی توسط Backend محاسبه می‌شود و امتیاز ارسالی کاربر مبنای پاداش نیست.
3. حداقل زمان بازی قابل تنظیم با `MIN_GAME_SECONDS` است.
4. یک Session فعال برای هر کاربر/بازی جلوگیری می‌شود.
5. RewardPool در صورت وجود Pool دوره جاری، قبل از پرداخت پاداش بررسی و مصرف می‌شود.
6. Frontend و Backend برای برداشت با `destination`، `address` و `walletAddress` سازگار شده‌اند.
7. ایمیل پروفایل از Frontend قابل ویرایش نیست چون Backend فقط username را اجازه می‌دهد.

## نکته مالی

Endpoint برداشت فقط درخواست برداشت را ثبت می‌کند و انتقال واقعی USDT انجام نمی‌دهد. پرداخت واقعی باید در Backend با یک سرویس کیف پول امن، صف پرداخت، امضای تراکنش خارج از وب‌درخواست و کنترل‌های امنیتی/قانونی جداگانه پیاده‌سازی شود.
