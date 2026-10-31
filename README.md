# 批发订货系统（Wholesale Ordering Portal）

进口食品・饮料批发用的 B2B 订货 + 库存 + 应收账款管理系统。
管理端和客户端都支持 **日本語 / 中文 / English**，按浏览器语言自动切换，也可以手动选择。

技术：Next.js 15 + Supabase（Postgres 数据库、登录）+ 你自己的邮箱（SMTP）发邮件，也可以用 Resend。

---

## 一、功能一览

### 客户（商店）
- 首次注册公司信息 → 管理员审核通过后才能下单
- 商品目录：搜索、分类、收藏、可订库存、最近保质期、专属价格
- 购物车自动保存；选择收货地址（可多个门店）、希望送达日期、备注
- 下单前显示含税合计（8% / 10% 分开计算）和剩余信用额度
- 订单：待确认可直接**修改 / 取消**；已确认只能**申请取消**；“再来一单”
- 账款：当前欠款、逾期、余额、剩余额度、按月汇总、未结清订单、付款记录
- 打印：纳品书（适格请求书）、月度请求书
- 店员账号（member_role = staff）看不到账款

### 管理员
- 概览：待确认订单、取消申请、待审核客户、应收、逾期、库存紧张、临期批次
- 订单：确认 → 在订单页点 **“发给客户”“发给快递”**，系统自动生成邮件模板（可修改）后发送；快递邮件里有一键确认链接 → 快递商点链接登记出货（快递商不需要账号）→ 自动扣库存、生成应收、通知客户
- 也可以手动登记发货；处理取消申请（同意时自动通知快递商取消）
- 商品：三种语言名称、税率、每箱个数、起订量、库存提醒、图片、客户专属价
- 入库：按批次（批次号、保质期、每箱成本）
- 库存：批次一览、临期提醒、盘点调整（必须填原因）、库存流水
- 客户：审核 / 停用、信用额度、付款期限、内部备注
- 付款 / 结清：自动抵扣最早欠款、勾选订单结清、按月结清、部分付款、多付转余额、作废（留记录）
- 应收账款账龄（未到期 / 1–30 / 31–60 / 60 天以上）
- 召回追溯：输入批次号 → 发给了哪些客户 → 一键群发通知
- 邮件记录、操作日志（不可删除）、系统设置

---

## 二、部署步骤（大约 30 分钟）

### 1. 建立 Supabase 项目
1. 在 https://supabase.com 新建项目（区域建议选 Tokyo）。
2. 打开 **SQL Editor**，按顺序运行：
   - `supabase/migrations/0001_schema.sql`
   - `supabase/migrations/0002_functions.sql`
   - `supabase/migrations/0003_security.sql`
   - `supabase/migrations/0004_storage.sql`（商品图片）
   - `supabase/migrations/0005_search_path.sql`
   - `supabase/seed.sql`（可选：4 个示例商品，试用后可下架）
3. **Authentication → URL Configuration**：
   - Site URL：你的网站网址，例如 `https://order.example.com`
   - Redirect URLs：加入 `https://order.example.com/auth/callback`
4. 如果不想让客户注册时验证邮箱，可以在 **Authentication → Providers → Email** 关闭 “Confirm email”（反正还需要你审核）。

### 2. 设定管理员
1. 在网站的注册页随便注册一个账号，或在 Supabase **Authentication → Users → Add user** 新建。
2. 在 SQL Editor 运行（换成你的邮箱）：
   ```sql
   update profiles set role = 'admin', customer_id = null where email = 'you@example.com';
   ```
   如果是从注册页注册的，会多出一条“待审核客户”，可以在后台把它停用。

### 3. 连接发信邮箱（用你现有的邮箱）
系统用你自己的邮箱发邮件，客户和快递商收到的就是从你邮箱发出的信，回复也回到你的邮箱。在环境变量里填 4 项就行：

| 邮箱 | SMTP_HOST | SMTP_PORT | SMTP_USER / SMTP_PASS |
|---|---|---|---|
| Gmail / Google Workspace | `smtp.gmail.com` | `465` | 邮箱地址 / **应用专用密码**（Google 账号 → 安全 → 两步验证 → 应用专用密码） |
| Outlook / Microsoft 365 | `smtp.office365.com` | `587` | 邮箱地址 / 密码（公司账号可能需要管理员开启 SMTP） |
| 公司自己的邮箱（Xserver、さくら、お名前.com 等） | 服务商给的 SMTP 服务器 | `465` 或 `587` | 邮箱地址 / 邮箱密码 |

- `EMAIL_FROM` 可写成 `東京輸入食品 <orders@your-domain.com>`，地址要和 SMTP_USER 一致。
- 设置好后，后台 **设置 → 发信邮箱** 会显示“已连接”，可以点“发送测试邮件”试一下。
- 不想用自己的邮箱，也可以用 https://resend.com（填 `RESEND_API_KEY`）。两种都没填时，邮件只保存在“邮件记录”里，不会真正发出。

### 4. 部署网站（Vercel）
1. 把本文件夹上传到 GitHub，在 https://vercel.com 导入。
2. 设置环境变量（参考 `.env.example`）：

| 变量 | 说明 |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 同上（anon / publishable key） |
| `SUPABASE_SERVICE_ROLE_KEY` | 同上（service_role，**绝对不能公开**） |
| `NEXT_PUBLIC_SITE_URL` | 选填：网站正式网址。部署在 Vercel 时不填会自动使用 Vercel 的网址；以后绑定自己的域名再填 |
| `SMTP_HOST` `SMTP_PORT` `SMTP_USER` `SMTP_PASS` | 你自己的发信邮箱（见上一步） |
| `EMAIL_FROM` | 例如 `東京輸入食品 <orders@example.com>` |
| `RESEND_API_KEY` | 选填，不用自己的邮箱时才需要 |

3. 部署完成后，用管理员账号登录 → **设置**：填写公司名称、地址、适格请求书登记号码、收款账户、**快递商邮箱**、截止时间、付款期限。

### 本地开发
```bash
npm install
cp .env.example .env.local   # 填入上面的值
npm run dev                  # http://localhost:3000
```

---

## 三、业务规则（重要）

**库存三个数**
- 实际库存 = 各批次剩余数量合计
- 锁定 = 待确认 + 已确认（未发货）订单的数量
- 可售 = 实际 − 锁定（客户看到的是这个）
- 下单时锁定商品行，两个客户同时下单也不会超卖
- 发货时按 **保质期最早的批次先出（FEFO）**，并记录每个订单用了哪个批次（召回用）

**订单状态**：待确认 → 已确认（已通知快递）→ 已发货；任何时候可变为已取消（已发货除外）。

**金额与消费税（インボイス制度）**
- 商品价格为税抜，税率 8%（食品・饮料）或 10%（酒类等）
- 每张订单按税率分别合计，每个税率只做一次端数处理（切捨て）
- 纳品书 = 每张订单的适格请求书；月度请求书汇总当月纳品书

**应收账款**
- 发货时才记入欠款（金额以发货时为准）
- 归属月份 = 发货月；付款期限 = 当月最后一天 + N 天（客户可单独设置）
- 付款可自动抵扣 / 指定订单 / 指定月份；多付的钱成为余额，下次发货自动抵扣
- 银行手续费等差额用“调整”方式登记
- 付款、应收、邮件、日志都**不能删除**（电子帐簿保存法），录错用“作废”

**信用额度**：欠款 + 未发货订单 − 余额 超过额度时不能下单。

---

## 四、测试

```bash
npm run test:db     # 用内存 Postgres 跑完整业务流程（45 项）
```
`tests/e2e/flow.mjs` 是浏览器端到端测试（注册 → 审核 → 下单 → 修改 → 确认 → 取消申请 → 快递确认 → 付款 → 打印 → 切换语言），需要连接一个测试用 Supabase。

---

## 五、文件结构

```
supabase/migrations/   数据库结构、业务函数、权限
src/app/(auth)/        登录、注册、找回密码、待审核
src/app/shop/          客户端（商品、购物车、订单、账款、公司信息）
src/app/admin/         管理端
src/app/courier/       快递商确认页（凭邮件链接，无需登录）
src/app/print/         纳品书、请求书
src/lib/i18n/          三种语言的文字（zh.ts 为标准，其它语言缺字会编译报错）
src/lib/actions/       表单操作
src/lib/mail.ts        邮件模板（三种语言）与发送、存档
```

---

## 六、第二期建议

- 上传银行明细 CSV，自动核对付款（入金消込）
- 进口成本：关税、运费等诸费按批次分摊，计算每个商品 / 客户的毛利
- 导出 freee / マネーフォワード 格式
- LINE 通知
- 店主邀请店员子账号
- 管理员代客下单（电话、传真订单）——数据库函数 `place_order` 已支持
- 退货 / 破损登记
- 快递商不点链接而是回复邮件时，自动读取回复内容
