"""Django settings for the MomentBid backend."""

from datetime import timedelta
from pathlib import Path

import environ

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent
ROOT_DIR = BASE_DIR.parent

env = environ.Env(
    DEBUG=(bool, True),
    SECRET_KEY=(str, "unsafe-dev-secret"),
    ALLOWED_HOSTS=(list, ["*"]),
    CORS_ALLOWED_ORIGINS=(list, []),
    USE_MOCK_BLOCKCHAIN=(bool, True),
    BLOCKCHAIN_CHAIN_ID=(int, 31337),
    BLOCKCHAIN_RPC_URL=(str, "http://127.0.0.1:8545"),
    REDIS_URL=(str, "redis://127.0.0.1:6379/1"),
    RABBITMQ_URL=(str, "amqp://guest:guest@localhost:5672//"),
)
environ.Env.read_env(ROOT_DIR / ".env")


# Quick-start development settings - unsuitable for production
# See https://docs.djangoproject.com/en/6.0/howto/deployment/checklist/

# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = env("SECRET_KEY")

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = env("DEBUG")

ALLOWED_HOSTS = env("ALLOWED_HOSTS")


# Application definition

INSTALLED_APPS = [
    "daphne",
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "corsheaders",
    "channels",
    "rest_framework",
    "rest_framework_simplejwt",
]

EXTERNAL_APPS = [
    "apps.accounts",
    "apps.wallets",
    "apps.matches",
    "apps.bidding",
    "apps.api_gateway",
]

INSTALLED_APPS += EXTERNAL_APPS

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

# Channel Layers with RabbitMQ
CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels_rabbitmq.core.RabbitmqChannelLayer",
        "CONFIG": {
            "host": "amqp://guest:guest@localhost:5672/",
            # Optional: adjust expiry (default 60s) or capacity
            "expiry": 60,
            "local_capacity": 100,
        },
    }
}


# Database
# https://docs.djangoproject.com/en/6.0/ref/settings/#databases

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": BASE_DIR / "db.sqlite3",
    }
}


# Custom user model
AUTH_USER_MODEL = "accounts.User"


# Password validation
# https://docs.djangoproject.com/en/6.0/ref/settings/#auth-password-validators

AUTH_PASSWORD_VALIDATORS = [
    {
        "NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.CommonPasswordValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.NumericPasswordValidator",
    },
]


# Internationalization
# https://docs.djangoproject.com/en/6.0/topics/i18n/

LANGUAGE_CODE = "en-us"

TIME_ZONE = "UTC"

USE_I18N = True

USE_TZ = True


# Static files (CSS, JavaScript, Images)
# https://docs.djangoproject.com/en/6.0/howto/static-files/

STATIC_URL = "/static/"
MEDIA_URL = "/media/"
MEDIA_ROOT = ROOT_DIR / "data"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# DRF and JWT
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": ("rest_framework.permissions.IsAuthenticated",),
    "EXCEPTION_HANDLER": "utils.api_exception_handler.custom_exception_handler",
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(days=30),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "AUTH_HEADER_TYPES": ("Bearer",),
}

# CORS
CORS_ALLOW_ALL_ORIGINS = DEBUG
if not CORS_ALLOW_ALL_ORIGINS:
    CORS_ALLOWED_ORIGINS = env("CORS_ALLOWED_ORIGINS")

# Blockchain settings
USE_MOCK_BLOCKCHAIN = env("USE_MOCK_BLOCKCHAIN")
BLOCKCHAIN_RPC_URL = env("BLOCKCHAIN_RPC_URL")
BLOCKCHAIN_CHAIN_ID = env("BLOCKCHAIN_CHAIN_ID")
ADMIN_WALLET_PRIVATE_KEY = env("ADMIN_WALLET_PRIVATE_KEY", default="")
ORACLE_WALLET_PRIVATE_KEY = env("ORACLE_WALLET_PRIVATE_KEY", default="")
WALLET_ENCRYPTION_KEY = env("WALLET_ENCRYPTION_KEY", default="")

MBT_CONTRACT_ADDRESS = env("MBT_CONTRACT_ADDRESS", default="")
MOMENTBID_CORE_ADDRESS = env("MOMENTBID_CORE_ADDRESS", default="")
EXCLUSION_MANAGER_ADDRESS = env("EXCLUSION_MANAGER_ADDRESS", default="")
ORACLE_CONTROLLER_ADDRESS = env("ORACLE_CONTROLLER_ADDRESS", default="")
