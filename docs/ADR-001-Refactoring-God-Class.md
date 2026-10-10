# Architecture Decision Record (ADR-001): Refactoring Legacy God Class to Ports & Adapters Architecture

## Status
Accepted

# Context
# Context: Why the legacy class was problematic.

The legacy system utilized a monolithic `LegacySubscriptionManager` "God class" to manage subscription renewals. This implementation suffered from severe architectural anti-patterns and technical debt:

1. **Hidden Dependencies & Tight Coupling**: The legacy class directly instantiated infrastructure classes (`new DatabaseConnection(process.env.DB_URL)` and `new ThirdPartyPaymentClient(process.env.PAYMENT_API_KEY)`). This created rigid coupling to specific database drivers and payment SDKs, preventing modular testing, dependency swapping, or configuration management.
2. **Temporal Coupling (Non-deterministic System State)**: Direct invocation of `new Date()` within core business rules bound the class to the operating system clock. This made testing time-sensitive logic (such as checking whether a subscription has expired or applying month-specific promotional pricing) non-deterministic and reliant on unreliable environment manipulation.
3. **I/O & Business Logic Interleaving**: The business rules (e.g., checking expiration dates, applying a 10% discount in December, calculating the new expiration timestamp by adding 1 year) were interspersed with raw SQL queries and network calls. Because business rules were inseparable from I/O operations, testing business calculations in isolation was impossible without spinning up a live PostgreSQL database and a mock HTTP payment gateway.
4. **Violation of Single Responsibility Principle (SRP)**: The legacy class had multiple reasons to change: SQL schema modifications, Stripe API contract alterations, date calculation rule changes, and promotional pricing adjustments.
5. **Violation of Dependency Inversion Principle (DIP)**: High-level business logic directly depended on low-level infrastructure implementations rather than abstractions.

# Decision
# Decision: The architectural pattern chosen (Ports & Adapters / Dependency Injection).

We resolved these issues by adopting **Hexagonal Architecture (Ports and Adapters)** combined with **Inversion of Control (Dependency Injection)**:

1. **Domain Isolation**:
   - The core domain model and business rules are encapsulated in `SubscriptionBillingService` inside `src/domain/services/`.
   - The domain layer is pure and has zero external dependencies on databases, ORMs, HTTP clients, or framework-specific objects.
2. **Definition of Domain Ports (Interfaces)**:
   - Abstract contracts were defined in `src/domain/ports/`:
     - `ISubscriptionRepository`: Abstracts subscription retrieval and expiration date updates.
     - `IUserRepository`: Abstracts user data retrieval.
     - `IPaymentGateway`: Abstracts charging customers without exposing payment vendor SDKs.
     - `ITimeProvider`: Abstracts system time retrieval (`getCurrentTime()`), eliminating temporal coupling.
3. **Constructor Injection**:
   - `SubscriptionBillingService` receives all dependencies via its constructor:
     `constructor(subscriptionRepo, userRepo, paymentGateway, timeProvider)`.
   - Direct calls to `new Date()`, `Date.now()`, or direct DB/HTTP client instantiations are strictly forbidden in the domain service.
4. **Infrastructure Adapters**:
   - Concrete implementations were placed in `src/infrastructure/adapters/`:
     - `SystemTimeProvider`: Adapts the native system clock.
     - `PostgresSubscriptionRepository`: Adapts PostgreSQL queries for subscriptions.
     - `PostgresUserRepository`: Adapts PostgreSQL queries for users.
     - `MockPaymentGateway`: Simulates payment processing for third-party payment gateways.
5. **API Composition Root**:
   - The API Controller (`src/api/controllers/SubscriptionController.ts`) acts as the entrypoint and composition root, instantiating the concrete adapters and injecting them into `SubscriptionBillingService` for incoming requests at `POST /api/renew`.

# Consequences
# Consequences: Trade-offs (e.g., increased complexity/file count vs. testability).

### Positive Consequences
- **100% Deterministic Testability**: Core business rules (December discount, expiration rules, 1-year date extension, payment gateway error handling) can be tested completely in memory with zero external I/O or network dependencies.
- **Maintainability & Modularity (SRP)**: Each component has a single reason to change. Swapping PostgreSQL for another database or swapping Stripe for another payment processor requires updating only the respective adapter, with zero modifications to domain rules.
- **Flexibility**: We can swap adapters at runtime or during testing by injecting test doubles (stubs/spies/mocks).

### Negative / Trade-off Consequences
- **Increased File & Abstraction Count**: Moving from a single file to a structured directory tree with explicit interfaces, domain entities, adapters, and controller layers increases boilerplate code and upfront complexity.
- **Indirection**: Developers unfamiliar with Hexagonal Architecture must navigate through port interfaces to identify concrete runtime implementations.

# Code Smells Addressed
# Code Smells Addressed: Explicitly mapping original smells (temporal coupling, I/O interleaving) to their solutions.

| Legacy Code Smell | Architectural Solution Implemented | Location in Refactored Codebase |
| :--- | :--- | :--- |
| **Temporal Coupling** (`new Date()`) | Abstracted behind `ITimeProvider` port. Deterministic time is injected via constructor, enabling deterministic test stubs (e.g., forcing December 15th). | Port: `src/domain/ports/ITimeProvider.ts`<br>Adapter: `src/infrastructure/adapters/SystemTimeProvider.ts` |
| **Hidden Infrastructure Dependencies** (`new DatabaseConnection`, `new ThirdPartyPaymentClient`) | Extracted behind `ISubscriptionRepository`, `IUserRepository`, and `IPaymentGateway` interfaces. Dependencies are passed through constructor injection. | Ports: `src/domain/ports/`<br>Adapters: `src/infrastructure/adapters/` |
| **I/O & Business Logic Interleaving** | Separated into pure domain service (`SubscriptionBillingService`) and concrete adapters. The domain logic only interacts with interface contracts. | Service: `src/domain/services/SubscriptionBillingService.ts` |
| **Untestable Edge Cases** | Isolated unit test suite using test doubles (mocks for repos and gateways, deterministic stubs for time provider) achieving >80% code coverage without network or disk access. | Tests: `tests/unit/SubscriptionBillingService.test.ts` |
| **Monolithic Coupling to Framework** | Controllers handle HTTP I/O (`Express`), mapping request bodies to service parameters and service domain results to standard HTTP responses (200 OK / 400 Bad Request). | Controller: `src/api/controllers/SubscriptionController.ts` |
