import csv

FIELDS = ["date", "project", "minutes"]


def export_csv(rows, path, append=False):
    with open(path, "a" if append else "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=FIELDS)
        writer.writeheader()
        writer.writerows(rows)
