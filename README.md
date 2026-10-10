# Refactored Subscription Billing Engine

A production-grade refactoring of a legacy, tightly-coupled "God Class" subscription billing manager into Hexagonal Architecture (Ports and Adapters) adhering to SOLID principles and Inversion of Control / Dependency Injection.

---

## Architecture Overview

```
                      +-----------------------------+
                      |       API Controller        |
                      | (HTTP Boundary / Entrypoint)|
                      +--------------+--------------+
                                     |
                                     | Injects Adapters
                                     v
+-------------------------------------------------------------------------+
|                              Domain Layer                               |
|                                                                         |
|  +-------------------------------------------------------------------+  |
|  |                    SubscriptionBillingService                     |  |
|  |           (Pure Business Logic: Zero External Dependencies)       |  |
|  +-------------------------------------------------------------------+  |
|            |                           |                       |        |
|            v                           v                       v        |
|  +-------------------+      +---------------------+  +---------------+  |
|  |   ITimeProvider   |      | ISubscriptionRepo   |  |IPaymentGateway|  |
|  |      (Port)       |      |       (Port)        |  |    (Port)     |  |
|  +-------------------+      +---------------------+  +---------------+  |
+------------^---------------------------^---------------------^----------+
             |                           |                     |
   Implements|                 Implements|           Implements|
+------------+---------------------------+---------------------+----------+
|                         Infrastructure Adapters                         |
|                                                                         |
|  +-------------------+      +---------------------+  +---------------+  |
|  |SystemTimeProvider |      |PostgresSubscription |  | MockPayment   |  |
|  |                   |      |     Repository      |  |    Gateway    |  |
|  +---------+---------+      +----------+----------+  +-------+-------+  |
|            |                           |                     |          |
+------------|---------------------------|---------------------|----------+
             v                           v                     v
       System Clock             PostgreSQL Database       Stripe API
```

### SOLID Principles Applied
- **Single Responsibility Principle (SRP)**: Each class has exactly one reason to change. `SubscriptionBillingService` changes only when business rules change; database changes affect only repository adapters; external API changes affect only the payment gateway adapter.
- **Open/Closed Principle (OCP)**: New payment processors (e.g. PayPal) or storage backends (e.g. MySQL, DynamoDB) can be introduced by creating new adapters implementing domain ports without altering existing domain business logic.
- **Liskov Substitution Principle (LSP)**: Any adapter fulfilling a port interface (e.g. `MockPaymentGateway` vs `StripePaymentAdapter`) can be seamlessly substituted into the domain service without altering system correctness.
- **Interface Segregation Principle (ISP)**: Interfaces are lean and focused (`ITimeProvider`, `IPaymentGateway`, `ISubscriptionRepository`, `IUserRepository`).
- **Dependency Inversion Principle (DIP)**: High-level domain business rules depend strictly on abstractions (Ports), never on low-level infrastructure modules. Concrete details (Adapters) depend on domain abstractions.

---

## Directory Structure

```
├── .env.example                               # Documented environment variables
├── .env                                       # Local environment configuration
├── docker-compose.yml                         # Multi-container orchestration (db + api)
├── Dockerfile                                 # Multi-stage production container build
├── submission.json                            # Seeded test IDs for evaluation
├── package.json                               # Dependencies and test scripts
├── tsconfig.json                              # TypeScript compiler configuration
├── jest.config.js                             # Jest configuration with coverage thresholds
├── docs/
│   └── ADR-001-Refactoring-God-Class.md       # Architecture Decision Record
├── legacy/
│   └── LegacySubscriptionManager.ts           # Original tightly-coupled God Class
├── src/
│   ├── domain/
│   │   ├── models/                            # Plain domain entities (User, Subscription)
│   │   ├── ports/                             # Abstract interfaces (ITimeProvider, etc.)
│   │   └── services/                          # Pure business logic (SubscriptionBillingService)
│   ├── infrastructure/
│   │   ├── adapters/                          # Concrete implementations (Postgres, Stripe, SystemTime)
│   │   └── database/                          # Schemas, seeds, connection pool, and migrations
│   └── api/
│       ├── controllers/                       # Express route controllers
│       └── server.ts                          # Express server setup & entrypoint
└── tests/
    ├── unit/                                  # Isolated unit tests (0 external I/O)
    └── integration/                           # Controller and API endpoint tests
```

---

## Running Unit Tests (In Isolation)

Unit tests run against mock objects without requiring a database or internet connection, achieving >80% code coverage:

```bash
npm test
```

Or with detailed coverage reporting:

```bash
npm run test:unit
```

### Verified Test Cases
1. **December Promotional Discount**: Verifies 10% discount is applied when renewal occurs in December (month 11 in JS Date).
2. **Standard Pricing**: Verifies standard base price is charged in non-December months.
3. **Temporal Invalidation**: Fails renewal when subscription expiration date is in the future.
4. **Payment Gateway Graceful Failure**: Handles payment gateway failure cleanly.
5. **Payment Gateway Exception Handling**: Catches network/API exceptions from gateway.
6. **Entity Lookup Failures**: Rejects non-existent users and subscriptions.
7. **Date Extension Rule**: Extends expiration timestamp by exactly 1 year from the current time.

---

## Running with Docker Compose

To build and run the entire stack (PostgreSQL database with healthchecks, migrations, seeds, and the API):

```bash
docker-compose up --build -d
```

### Healthcheck and Automatic Seeding
- The `db` service runs PostgreSQL 15 and executes `init.sql` upon container initialization to establish the schema and seed test data.
- The `api` service waits for `db` to be healthy before starting.
- Container health can be verified with:
  ```bash
  docker-compose ps
  ```

---

## API Specification

### Endpoint: Renew Subscription
- **Method**: `POST`
- **Route**: `/api/renew`
- **Headers**: `Content-Type: application/json`

#### Request Body
```json
{
  "userId": "user-expired-1"
}
```

#### Responses

##### 200 OK (Successful Renewal)
```json
{
  "success": true,
  "message": "Renewal successful"
}
```

##### 400 Bad Request (Business Rule Failure / Not Expired)
```json
{
  "success": false,
  "message": "Subscription is not yet expired"
}
```

---

## Seeded Evaluation Data (`submission.json`)

| Identifier Key | Value | Status | Expected Behavior |
| :--- | :--- | :--- | :--- |
| `validUserId` | `user-expired-1` | Expired (`2020-01-01`) | 200 OK: Renewal successful |
| `unexpiredUserId` | `user-unexpired-2` | Unexpired (`2099-12-31`) | 400 Bad Request: Subscription is not yet expired |
| `nonExistentUserId` | `user-nonexistent-999` | Not in DB | 400 Bad Request: User not found |
