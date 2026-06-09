# Forno Brace

A **full-stack** website for an artisan bakery with an online ordering system, built with Node.js, Express, and SQLite.

## Description

Forno Brace is a complete web application for an artisan bakery located at Via dei Forni 14, Milan (Porta Romana district). The site allows customers to browse the menu, build an order, and complete checkout with home delivery, pickup, or dine-in options. It includes an admin panel with real-time order monitoring and menu management.

The design follows a warm artisanal palette (cream, brown, terracotta) with refined typography, inspired by the authentic atmosphere of a wood-fired oven bakery.

## Goals

- Provide an **intuitive online ordering system** for an artisan shop
- Support **three service modes**: home delivery, pickup, and dine-in
- Offer a **reactive admin panel** with real-time notifications for order management
- Create a **professional and authentic** design, far from template aesthetics
- Be **easily deployable** on cloud platforms (Render) via blueprint configuration

## Key Features

### Customer Site
- **Hero section** with animated product ticker
- **Product menu** with category filter, text search, image carousel, quantity stepper
- **Persistent cart** in localStorage with subtotal, delivery fee, and total
- **Checkout** with service mode selection (delivery, pickup, dine-in), data form, payment method
- **Simulated card payment** (ready for real Stripe integration)
- **Order confirmation** with animated confetti effect
- **Authentication** (register, login, editable profile, password change)
- **Order history** with 4-step progress bar and adaptive labels
- **Informational sections**: About Us, Gallery, How It Works, Contacts with map
- **GDPR cookie banner** with granular consent
- **WhatsApp FAB** and direct link in header

### Admin Panel
- **Dashboard** with statistics: today's orders, today's revenue, orders in progress, total revenue
- **Order management** with status filter, detailed cards, status change, mark as paid
- **Real-time notifications**: 5-second polling, Web Audio API sound, desktop notification, blinking title
- **Menu CRUD**: add/edit/delete products, multi-image upload with drag-and-drop
- **Gallery manager** for product images with thumbnails and "Cover" badge

### Backend REST API
- **20+ endpoints** for authentication, products, orders, statistics
- **JWT middleware** for authentication and role protection (requireAuth, requireAdmin)
- **Server-side validation** for all inputs
- **SQLite transactions** for atomic order creation
- **Automatic calculation** of delivery fee with configurable free threshold

## Technologies

| Category | Technology |
|---|---|
| **Runtime** | Node.js 22.x |
| **Framework** | Express 4.21 |
| **Database** | SQLite with better-sqlite3 (WAL mode) |
| **Authentication** | JWT (jsonwebtoken) + bcryptjs |
| **Frontend** | HTML5, CSS3, vanilla JavaScript (no framework) |
| **Font** | Fraunces + Source Serif 4 (Google Fonts) |
| **Icons** | Inline SVG sprite |
| **Web APIs** | Canvas (confetti), Web Audio, Notification, IntersectionObserver, Drag & Drop, FileReader |
| **Deployment** | Render (render.yaml blueprint) |

## Project Structure

```
Forno_Brace/
├── server.js                # Express server + REST API
├── auth.js                  # JWT and authentication middleware
├── config.js                # App configuration
├── db.js                    # SQLite connection + schema
├── seed.js                  # Initial database seeding
├── payments.js              # Card payment simulator
├── package.json             # npm dependencies
├── render.yaml              # Render deploy blueprint
├── forno.db                 # SQLite database
├── public/
│   ├── index.html           # Customer site
│   ├── admin.html           # Admin panel
│   ├── privacy.html         # Privacy policy
│   ├── cookie-policy.html   # Cookie policy
│   ├── css/style.css        # Complete design system
│   └── js/
│       ├── common.js        # API client, utilities
│       ├── app.js           # Customer logic
│       └── admin.js         # Admin logic
└── graphify-out/            # Code analysis report
```

## Future Improvements

- **Real Stripe integration** (simulator already in place)
- **Inventory tracking** with quantity management
- **Push notifications** with background service worker
- **PWA** with installability and offline caching
- **Advanced analytics dashboard** with charts and trends
- **Loyalty program** for returning customers
- **Docker** for flexible deployment
- **PostgreSQL migration** for scalability
- **Automated tests** with a testing framework
- **Automatic order confirmation emails**
