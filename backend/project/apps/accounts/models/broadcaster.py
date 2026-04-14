from apps.accounts.models.brands import WalletProtectedOrganization


class Broadcaster(WalletProtectedOrganization):
    """Organization creating matches and event inventory."""

    def __str__(self) -> str:
        return self.name
