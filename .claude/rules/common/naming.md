# Naming Conventions

## General Principles
- Names should describe what something is or does, not how it works.
- Use domain-specific terminology from the project glossary.
- Avoid abbreviations unless universally understood: `id`, `url`, `db`, `config` are fine. `usr`, `mgr`, `proc` are not.
- Be consistent. If the codebase uses `remove`, do not introduce `delete` for the same concept.
- Longer names for larger scopes. Single letters only for loop counters and lambdas.

## JavaScript / TypeScript
- Variables and functions: `camelCase` (`getUserById`, `isActive`, `orderCount`).
- Classes and type aliases: `PascalCase` (`UserService`, `OrderStatus`, `ApiResponse`).
- Constants: `UPPER_SNAKE_CASE` for true constants (`MAX_RETRIES`, `DEFAULT_TIMEOUT`).
- Enums: `PascalCase` for name, `PascalCase` for members (`enum OrderStatus { Pending, Shipped }`).
- Booleans: prefix with `is`, `has`, `can`, `should` (`isEnabled`, `hasAccess`, `canEdit`).
- Event handlers: prefix with `on` or `handle` (`onClick`, `handleSubmit`).
- Files: `kebab-case.ts` for modules, `PascalCase.tsx` for React components.

## Python
- Variables and functions: `snake_case` (`get_user_by_id`, `is_active`, `order_count`).
- Classes: `PascalCase` (`UserService`, `OrderRepository`).
- Constants: `UPPER_SNAKE_CASE` (`MAX_RETRIES`, `DEFAULT_TIMEOUT`).
- Private members: single underscore prefix (`_internal_cache`, `_validate_input`).
- Dunder methods: double underscore (`__init__`, `__repr__`, `__eq__`).
- Modules and packages: `snake_case` (`user_service.py`, `data_access/`).
- Type variables: `PascalCase` with `T` suffix convention (`ItemT`, `ResponseT`).


## Database
- Tables: `snake_case`, plural (`users`, `order_items`, `payment_methods`).
- Columns: `snake_case`, singular (`user_id`, `created_at`, `is_active`).
- Primary keys: `id` in the owning table.
- Foreign keys: `<singular_table>_id` (`user_id`, `order_id`).
- Indexes: `idx_<table>_<columns>` (`idx_orders_user_id`, `idx_users_email`).
- Migrations: `<timestamp>_<description>` (`20260115_add_orders_status_column`).