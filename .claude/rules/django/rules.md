## Core Principles

- Use Django's conventions. Do not fight the framework. Custom solutions should be the exception, not the rule.
- Every queryset that touches a template or serializer must be optimized. Use `select_related` and `prefetch_related` by default.
- Write fat models, thin views. Business logic belongs in model methods, managers, or service functions, not in views.
- Migrations are code. Review them, test them, and never edit a migration that has been applied to production.

# Folder Sructure
- Make sure that all Django apps are organized under a single `apps` directory. This keeps the project structure clean and makes it easier to find code.
- Each app should have a clear purpose and contain related models, views, serializers, and tests
- Use a consistent naming convention for apps, such as `users`, `products`, `orders`, etc. Avoid generic names like `core` or `common` unless they truly contain shared code.
- Each app should have its own `urls.py` that defines the app's URL patterns. The project's main `urls.py` should include the app URLs using `include()`.
- The app should have a folder for views,serializer,models, tests, and other components. For example:
```apps/
    users/
        __init__.py
        serializers/
            __init__.py
            user.py
            role.py
        views/
            __init__.py
            user.py
            role.py
        api_urls/
            __init__.py
            urls.py # this will act as an API Gateway for the app, it will include all the API endpoints for the app
            user.py
            role.py
        models/
            __init__.py
            user.py
            roles.py
            accounts.py
```

## ORM Best Practices

- Use `select_related` for ForeignKey and OneToOneField lookups (SQL JOIN).
- Use `prefetch_related` for ManyToManyField and reverse ForeignKey lookups (separate query + Python join).
- Use `.only()` or `.defer()` to load only needed fields when fetching large models.
- Use `F()` expressions for database-level updates: `Product.objects.filter(id=1).update(stock=F("stock") - 1)`.
- Use `Q()` objects for complex queries: `User.objects.filter(Q(is_active=True) & (Q(role="admin") | Q(role="staff")))`.
- Use `.explain()` during development to verify query plans and index usage.

## Django REST Framework

- Use `ModelSerializer` with explicit `fields` lists. Never use `fields = "__all__"`.
- Implement custom permissions in `permissions.py`: subclass `BasePermission` and override `has_object_permission`.
- Use `FilterSet` from `django-filter` for queryset filtering. Define filter fields explicitly.
- Use pagination globally: set `DEFAULT_PAGINATION_CLASS` to `CursorPagination` for large datasets.
- Use `@action(detail=True)` for custom endpoints on ViewSets: `/users/{id}/deactivate/`.

## Authentication and Security

- Use `AbstractUser` for custom user models. Set `AUTH_USER_MODEL` before the first migration.
- Use `django-allauth` or `dj-rest-auth` with SimpleJWT for token-based API authentication.
- Enable CSRF protection for all form submissions. Use `@csrf_exempt` only for webhook endpoints with signature verification.
- Set `SECURE_SSL_REDIRECT`, `SECURE_HSTS_SECONDS`, and `SESSION_COOKIE_SECURE` in production settings.

## Async Django

- Use `async def` views with `await` for I/O-bound operations in Django 5+.
- Use `sync_to_async` to call ORM methods from async views. The ORM is not natively async yet.
- Use `aiohttp` or `httpx.AsyncClient` for non-blocking HTTP calls in async views.
- Run with `uvicorn` or `daphne` via ASGI for async support. WSGI does not support async views.

## Testing

- Use `pytest-django` with `@pytest.mark.django_db` for database access in tests.
- Use `factory_boy` with `faker` for test data generation. Define one factory per model.
- Use `APIClient` from DRF for API endpoint tests. Set authentication with `client.force_authenticate(user)`.
- Test permissions, validation errors, and edge cases, not just the happy path.

## Before Completing a Task

- Run `python manage.py check --deploy` to verify production readiness settings.
- Run `python manage.py makemigrations --check` to verify no missing migrations.
- Run `python manage.py showmigrations` to confirm migration state is consistent.


# Always use my CustomResponse class for API responses. It provides a consistent structure and handles common response patterns
@project\utils\custom_response.py

