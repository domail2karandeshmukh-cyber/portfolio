#!/bin/sh
# The requests of the capture: a client reading the shop's API.
for p in /health /api/parts /api/parts?page=2 /api/search?q=impeller /api/report?month=2026-10 /api/parts?page=3 /api/search?q=seal /api/report?month=2026-11 /api/parts/9101 /health; do
  curl -s --noproxy '*' -o /dev/null "http://127.0.0.1:8000$p"
done
