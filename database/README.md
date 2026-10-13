# 🗄️ Mithai Mahal — Database Setup Guide (MySQL Workbench)

This directory contains the standalone, one-click database export script **`sweet_shop_delivery_workbench.sql`** to run Mithai Mahal on any laptop.

---

## ⚡ How to Import in MySQL Workbench (Under 1 Minute)

### 1. Open MySQL Workbench
Launch **MySQL Workbench** on your machine and connect to your local MySQL instance (typically `Local instance MySQL80` on port `3306`).

### 2. Open the SQL Script
1. Click **File** from the top menu bar.
2. Select **Open SQL Script...** (or press `Ctrl + Shift + O` on Windows / `Cmd + Shift + O` on Mac).
3. Navigate to this file and select it:
   ```
   database/sweet_shop_delivery_workbench.sql
   ```

### 3. Execute the Script
1. Click the **⚡ Execute** (lightning bolt) icon on the SQL query toolbar.
2. The script will automatically:
   - Create the database `sweet_shop_delivery`.
   - Build all **31 relational tables** with indexes and foreign keys.
   - Insert all default seed records (artisanal sweet categories, sample sweets, sweet shops, and demo accounts).
3. In the left **Navigator** panel under **Schemas**, right-click and choose **Refresh All**. You will see `sweet_shop_delivery` with all tables ready!

---

## 🔑 Demo Login Accounts

| Role | Email | Password |
|---|---|---|
| **Super Admin** | `superadmin@mithaimahal.com` | `SuperAdminPass123!` |
| **Operations Admin** | `admin@gmail.com` | `AdminPassword123!` |
| **Customer** | `test.customer@gmail.com` | `Password123!` |

*(Or register a brand new customer or sweet shop vendor directly on the website).*

---

## ⚙️ Connecting Backend to Your Database

In the `backend/` folder:
1. Create a `.env` file (copy from `.env.example`).
2. Update `DB_PASSWORD` with your MySQL Workbench password:
   ```env
   DB_HOST=localhost
   DB_PORT=3306
   DB_USER=root
   DB_PASSWORD=YOUR_LOCAL_MYSQL_PASSWORD
   DB_NAME=sweet_shop_delivery
   ```
3. Start the backend with: `npm run dev`
