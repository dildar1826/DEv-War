# 🤝 Contributing to DEv-War

Thank you for considering contributing to DevWar.

This project is built on one principle:
Consistency beats motivation.

If you believe in building disciplined systems, you're welcome here.

---

## 🧭 Contribution Philosophy

Keep it:
- Simple
- Clean
- Secure
- Scalable

Every contribution should improve:
- Code clarity
- Performance
- User experience
- Security

---

## 🛠 Project Setup

Before contributing, you must set up Supabase locally or on your own Supabase project.

### 1️⃣ Create a Supabase Project

- Go to Supabase
- Create a new project
- Copy your API URL and anon public key

---

### 2️⃣ Run Database Setup

This repository includes a `setup.sql` file.

To create the required tables:

1. Open your Supabase dashboard
2. Go to **SQL Editor**
3. Open `setup.sql` from this repo
4. Paste the contents into the SQL editor
5. Click **Run**

This will create all required tables and policies.

⚠ Make sure Row Level Security (RLS) is enabled.

---

### 3️⃣ Configure Frontend

Update your `js/config.js`:

```js
const SUPABASE_URL = "your-project-url";
const SUPABASE_ANON_KEY = "your-anon-public-key";
