"""Export transaction hashes for IDs 1 through 55 to CSV.

Run from backend/project:
    python scripts/export_transactions_1_55.py
"""

from __future__ import annotations

import csv
import os
import sys
from pathlib import Path

import django


def _bootstrap_django() -> None:
    project_root = Path(__file__).resolve().parent.parent
    project_root_str = str(project_root)
    if project_root_str not in sys.path:
        sys.path.insert(0, project_root_str)

    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
    django.setup()


def main() -> None:
    _bootstrap_django()

    from apps.wallets.models import Transaction

    start_id = 1
    end_id = 55
    output_path = Path(__file__).resolve().parent / "transactions_1_55_hashes.csv"

    hashes = list(
        Transaction.objects.filter(id__gte=start_id, id__lte=end_id)
        .exclude(tx_hash="")
        .order_by("id")
        .values_list("tx_hash", flat=True)
    )

    with output_path.open("w", newline="", encoding="utf-8") as csv_file:
        writer = csv.writer(csv_file)
        writer.writerow(["tx_hash"])
        for tx_hash in hashes:
            writer.writerow([tx_hash])

    print(f"Found {len(hashes)} transactions with IDs {start_id}-{end_id}.")
    for tx_hash in hashes:
        print(tx_hash)
    print(f"CSV written to: {output_path}")


if __name__ == "__main__":
    main()
